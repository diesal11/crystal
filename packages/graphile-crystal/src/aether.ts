import * as assert from "assert";
import { Constraint } from "./constraints";
import {
  GraphQLSchema,
  OperationDefinitionNode,
  FragmentDefinitionNode,
  GraphQLField,
  FieldNode,
  GraphQLObjectType,
} from "graphql";
import { Plan, TrackedObjectPlan, assertFinalized } from "./plan";
import { graphqlCollectFields } from "./graphqlCollectFields";

/**
 * Implements the `MarkPlanActive` algorithm.
 */
function markPlanActive(plan: Plan, activePlans: Set<Plan>): void {
  if (activePlans.has(plan)) {
    return;
  }
  activePlans.add(plan);
  for (let i = 0, l = plan.dependencies.length; i < l; i++) {
    markPlanActive(plan.dependencies[i], activePlans);
  }
  for (let i = 0, l = plan.children.length; i < l; i++) {
    markPlanActive(plan.children[i], activePlans);
  }
}

/**
 * Implements the `NewAether` algorithm.
 */
export class Aether {
  public maxGroupId = 0;
  public groupId = this.maxGroupId;
  public readonly plans: Plan[] = [];
  public readonly planIdByPathIdentity: {
    [pathIdentity: string]: number;
  } = Object.create(null);
  public readonly valueIdByObjectByPlanId: {
    [planId: number]: WeakMap<object, symbol>;
  } = Object.create(null);
  public readonly variableValuesConstraints: Constraint[] = [];
  public readonly variableValuesPlan: TrackedObjectPlan;
  public readonly contextConstraints: Constraint[] = [];
  public readonly contextPlan: TrackedObjectPlan;
  public readonly rootValueConstraints: Constraint[] = [];
  public readonly rootValuePlan: TrackedObjectPlan;
  public readonly operationType: "query" | "mutation" | "subscription";

  constructor(
    public readonly schema: GraphQLSchema,
    // Note: whereas the `NewAether` algorithm refers to `document` and
    // `operationName`; we use `operation` and `fragments` because they're
    // easier to access in GraphQL.js
    public readonly operation: OperationDefinitionNode,
    public readonly fragments: {
      [fragmentName: string]: FragmentDefinitionNode;
    },
    public readonly variableValues: {
      [variableName: string]: unknown;
    },
    public readonly context: {
      [key: string]: unknown;
    },
    public readonly rootValue: unknown,
  ) {
    this.variableValuesPlan = new TrackedObjectPlan(
      this,
      variableValues,
      this.variableValuesConstraints,
    );
    this.contextPlan = new TrackedObjectPlan(
      this,
      context,
      this.contextConstraints,
    );
    this.rootValuePlan = new TrackedObjectPlan(
      this,
      rootValue,
      this.rootValueConstraints,
    );
    this.operationType = operation.operation;
    switch (this.operationType) {
      case "query": {
        this.planQuery();
        break;
      }
      case "mutation": {
        this.planMutation();
        break;
      }
      case "subscription": {
        this.planSubscription();
        break;
      }
      default: {
        const never: never = this.operationType;
        throw new Error(`Unsupported operation type '${never}'.`);
      }
    }

    this.optimizePlans();
    this.treeShakePlans();
    this.finalizePlans();
  }

  /**
   * Implements the `PlanAetherQuery` algorithm.
   */
  planQuery(): void {
    const rootType = this.schema.getQueryType();
    this.planSelectionSet(
      "",
      this.rootValuePlan,
      rootType,
      this.operation.selectionSet,
    );
  }

  /**
   * Implements the `PlanAetherMutation` algorithm.
   */
  planMutation(): void {
    const rootType = this.schema.getMutationType();
    if (!rootType) {
      return;
    }
    this.planSelectionSet(
      "",
      this.rootValuePlan,
      rootType,
      this.operation.selectionSet,
      true,
    );
  }

  /**
   * Implements the `PlanAetherSubscription` algorithm.
   */
  planSubscription(): void {
    const rootType = this.schema.getSubscriptionType();
    if (!rootType) {
      return;
    }
    const selectionSet = this.operation.selectionSet;
    const variableValuesPlan = this.variableValuesPlan;
    const groupedFieldSet = graphqlCollectFields(
      this,
      rootType,
      selectionSet,
      variableValuesPlan,
    );
    let firstKey: string | undefined = undefined;
    for (const key of groupedFieldSet.keys()) {
      if (firstKey !== undefined) {
        throw new Error("subscriptions may only have one top-level field");
      }
      firstKey = key;
    }
    assert.ok(firstKey != null, "selection set cannot be empty");
    const fields = groupedFieldSet.get(firstKey);
    if (!fields) {
      throw new Error("Consistency error.");
    }
    const field = fields[0];
    const fieldName = field.name.value; // Unaffected by alias.
    const rootTypeFields = rootType.getFields();
    const fieldSpec: GraphQLField<any, any> = rootTypeFields[fieldName];
    const subscriptionPlanResolver =
      fieldSpec.extensions?.graphile?.subscribePlan;
    if (subscriptionPlanResolver) {
      const trackedArguments = this.getTrackedArguments(rootType, field);
      const subscribePlan = this.executePlanResolver(
        subscriptionPlanResolver,
        this.rootValuePlan,
        trackedArguments,
      );
      this.planFieldArguments(field, trackedArguments, subscribePlan);
      this.planSelectionSet("", subscribePlan, rootType, selectionSet);
    } else {
      this.planSelectionSet("", this.rootValuePlan, rootType, selectionSet);
    }
  }

  /**
   * Implements the `TrackedArguments` algorithm.
   */
  getTrackedArguments(
    objectType: GraphQLObjectType,
    field: FieldNode,
  ): TrackedArguments {
    const { variableValuesPlan } = this;
    const argumentValues = graphqlCoerceArgumentValues(
      objectType,
      field,
      variableValuesPlan,
    );
  }

  /**
   * Implements the `OptimizePlans` algorithm.
   */
  optimizePlans(): void {
    for (let i = this.plans.length - 1; i >= 0; i--) {
      this.plans[i] = this.optimizePlan(this.plans[i]);
    }
  }

  /**
   * Implements the `OptimizePlan` algorithm.
   */
  optimizePlan(plan: Plan): Plan {
    return plan;
  }

  /**
   * Implements the `TreeShakePlans` algorithm.
   */
  treeShakePlans(): void {
    const activePlans = new Set<Plan>();

    for (const pathIdentity in this.planIdByPathIdentity) {
      const planId = this.planIdByPathIdentity[pathIdentity];
      const plan = this.plans[planId];
      markPlanActive(plan, activePlans);
    }

    for (let i = 0, l = this.plans.length; i < l; i++) {
      const plan = this.plans[i];
      if (!activePlans.has(plan)) {
        // We're going to delete this plan. Theoretically nothing can reference
        // it, so it should not cause any issues. If it does, it's due to a
        // programming bug somewhere where we're referencing a plan that hasn't
        // been added to the relevant dependencies/children. As such; I'm going
        // to bypass TypeScript here and delete the node whilst still letting
        // TypeScript guarantee it exists - better that the user gets a runtime
        // error trying to use it rather than using a nonsense plan.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.plans[i] = null as any;
      }
    }
  }

  /**
   * Implements the `FinalizePlans` and `FinalizePlan` algorithms.
   */
  finalizePlans(): void {
    const distinctActivePlansInReverseOrder = new Set<Plan>();
    for (let i = this.plans.length - 1; i >= 0; i--) {
      const plan = this.plans[i];
      if (plan !== null) {
        // checking the following would be redundant:
        // if (!distinctActivePlansInReverseOrder.has(plan))
        distinctActivePlansInReverseOrder.add(plan);
      }
    }
    for (const plan of distinctActivePlansInReverseOrder) {
      plan.finalize();
      assertFinalized(plan);
    }
  }
}
