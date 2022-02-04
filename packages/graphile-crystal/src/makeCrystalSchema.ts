import type {
  GraphQLFieldExtensions,
  GraphQLFieldResolver,
  GraphQLScalarLiteralParser,
  GraphQLScalarSerializer,
  GraphQLScalarValueParser,
  GraphQLSchema,
} from "graphql";
import {
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
  isScalarType,
  isUnionType,
} from "graphql";
import { buildASTSchema, parse } from "graphql";

import type {
  ArgumentPlanResolver,
  EnumPlanResolver,
  ExecutablePlanResolver,
  InputObjectFieldPlanResolver,
  ScalarPlanResolver,
} from "./interfaces";
import type { ExecutablePlan } from "./plan";
import { resolveType } from "./polymorphic";
import { crystalResolve, crystalWrapResolve } from "./resolvers";

type FieldPlans =
  | ExecutablePlanResolver<any, any, any, any>
  | {
      plan?: ExecutablePlanResolver<any, any, any, any>;
      subscribePlan?: ExecutablePlanResolver<any, any, any, any>;
      resolve?: GraphQLFieldResolver<any, any>;
      subscribe?: GraphQLFieldResolver<any, any>;
      args?: {
        [argName: string]: ArgumentPlanResolver<any, any, any, any, any>;
      };
    };

type ObjectPlans = {
  __Plan?: { new (...args: any[]): ExecutablePlan<any> };
} & {
  [fieldName: string]: FieldPlans;
};

type InputObjectPlans = {
  [fieldName: string]: InputObjectFieldPlanResolver<any, any, any, any>;
};

type InterfaceOrUnionPlans = {
  __resolveType?: (o: unknown) => string;
};

type ScalarPlans = {
  serialize?: GraphQLScalarSerializer<any>;
  parseValue?: GraphQLScalarValueParser<any>;
  parseLiteral?: GraphQLScalarLiteralParser<any>;
  plan?: ScalarPlanResolver<any, any>;
};

type EnumPlans = {
  // The internal value for the enum
  [enumValueName: string]:
    | EnumPlanResolver
    | string
    | number
    | boolean
    | {
        value?: unknown;
        plan?: EnumPlanResolver;
      };
};

interface CrystalPlans {
  [typeName: string]:
    | ObjectPlans
    | InputObjectPlans
    | InterfaceOrUnionPlans
    | ScalarPlans
    | EnumPlans;
}

export function makeCrystalSchema(details: {
  typeDefs: string;
  plans: CrystalPlans;
}): GraphQLSchema {
  const { typeDefs, plans } = details;

  const schema = buildASTSchema(parse(typeDefs), {
    // TODO: enable?
    enableDeferStream: true,
  });

  // Now add the plans/etc to the schema
  for (const [typeName, spec] of Object.entries(plans)) {
    const type = schema.getType(typeName);
    if (!type) {
      console.warn(
        `'plans' specified configuration for type '${typeName}', but that type was not present in the schema`,
      );
      continue;
    }
    if (isObjectType(type)) {
      if (typeof spec !== "object" || !spec) {
        throw new Error(`Invalid object config for '${typeName}'`);
      }

      const objSpec = spec as ObjectPlans;
      const fields = type.getFields();
      for (const [fieldName, fieldSpec] of Object.entries(spec)) {
        if (fieldName === "__Plan") {
          (type.extensions as any).graphile = { Plan: fieldSpec };
          continue;
        }

        const field = fields[fieldName];
        if (!field) {
          console.warn(
            `'plans' specified configuration for object type '${typeName}' field '${fieldName}', but that field was not present in the type`,
          );
          continue;
        }

        if (typeof fieldSpec === "function") {
          // it's a plan
          field.resolve = crystalResolve;
          (field.extensions as any).graphile = {
            plan: fieldSpec,
          };
        } else {
          // it's a spec
          const graphileExtensions: GraphQLFieldExtensions<
            any,
            any
          >["graphile"] = {};
          (field.extensions as any).graphile = graphileExtensions;
          if (fieldSpec.resolve || fieldSpec.plan) {
            field.resolve = fieldSpec.resolve
              ? crystalWrapResolve(fieldSpec.resolve)
              : crystalResolve;
          }
          if (fieldSpec.subscribe || fieldSpec.subscribePlan) {
            field.subscribe = fieldSpec.subscribe
              ? crystalWrapResolve(fieldSpec.subscribe)
              : crystalResolve;
          }
          if (fieldSpec.plan) {
            graphileExtensions.plan = fieldSpec.plan;
          }
          if (fieldSpec.subscribePlan) {
            graphileExtensions.subscribePlan = fieldSpec.subscribePlan;
          }

          if (typeof fieldSpec.args === "object" && fieldSpec.args != null) {
            for (const [argName, argSpec] of Object.entries(fieldSpec.args)) {
              const arg = field.args.find((arg) => arg.name === argName);
              if (!arg) {
                console.warn(
                  `'plans' specified configuration for object type '${typeName}' field '${fieldName}' arg '${argName}', but that arg was not present in the type`,
                );
                continue;
              }
              if (typeof argSpec === "function") {
                (arg.extensions as any).graphile = {
                  plan: argSpec,
                };
              } else {
                console.warn(
                  `Invalid configuration for plans.${typeName}.${fieldName}.args.${argName}`,
                );
                // Invalid
              }
            }
          }
        }
      }
    } else if (isInputObjectType(type)) {
      if (typeof spec !== "object" || !spec) {
        throw new Error(`Invalid input object config for '${typeName}'`);
      }

      const inputSpec = spec as InputObjectPlans;

      const fields = type.getFields();

      for (const [fieldName, fieldSpec] of Object.entries(inputSpec)) {
        const field = fields[fieldName];
        if (!field) {
          console.warn(
            `'plans' specified configuration for input object type '${typeName}' field '${fieldName}', but that field was not present in the type`,
          );
          continue;
        }
        if (typeof fieldSpec === "function") {
          (field.extensions as any).graphile = { plan: fieldSpec };
        } else {
          throw new Error(
            `Expected function input object type '${typeName}' field '${fieldName}', but an invalid value was received`,
          );
        }
      }
    } else if (isInterfaceType(type) || isUnionType(type)) {
      if (typeof spec !== "object" || !spec) {
        throw new Error(`Invalid interface/union config for '${typeName}'`);
      }
      const polySpec = spec as InterfaceOrUnionPlans;
      if (polySpec.__resolveType) {
        type.resolveType = polySpec.__resolveType;
      }
    } else if (isScalarType(type)) {
      if (typeof spec !== "object" || !spec) {
        throw new Error(`Invalid scalar config for '${typeName}'`);
      }
      const scalarSpec = spec as ScalarPlans;
      if (scalarSpec.serialize) {
        type.serialize = scalarSpec.serialize;
      }
      if (scalarSpec.parseValue) {
        type.parseValue = scalarSpec.parseValue;
      }
      if (scalarSpec.parseLiteral) {
        type.parseLiteral = scalarSpec.parseLiteral;
      }
      if (scalarSpec.plan) {
        (type.extensions as any).graphile = { plan: scalarSpec.plan };
      }
    } else if (isEnumType(type)) {
      if (typeof spec !== "object" || !spec) {
        throw new Error(`Invalid enum config for '${typeName}'`);
      }
      const enumValues = type.getValues();
      for (const [enumValueName, enumValueSpec] of Object.entries(spec)) {
        const enumValue = enumValues.find((val) => val.name === enumValueName);
        if (!enumValue) {
          console.warn(
            `'plans' specified configuration for enum type '${typeName}' value '${enumValueName}', but that value was not present in the type`,
          );
          continue;
        }
        if (typeof enumValueSpec === "function") {
          // It's a plan
          (enumValue.extensions as any).graphile = {
            plan: enumValueSpec,
          };
        } else if (typeof enumValueSpec === "object" && enumValueSpec != null) {
          // It's a full spec
          if (enumValueSpec.plan) {
            (enumValue.extensions as any).graphile = {
              plan: enumValueSpec.plan,
            };
          }
          if ("value" in enumValueSpec) {
            enumValue.value = enumValueSpec.value;
          }
        } else {
          // It must be the value
          enumValue.value = enumValueSpec;
        }
      }
    } else {
      const never: never = type;
      console.error(`Unhandled type ${never}`);
    }
  }
  return schema;
}
