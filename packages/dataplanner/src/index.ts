import chalk from "chalk";
import debugFactory from "debug";

import { crystalPrint, crystalPrintPathIdentity } from "./crystalPrint";
import { exportAsMany } from "./exportAs";
import { makeCrystalSchema } from "./makeCrystalSchema";

// TODO: doing this here feels "naughty".
debugFactory.formatters.c = crystalPrint;
debugFactory.formatters.p = (pathIdentity) =>
  chalk.bold.yellow(crystalPrintPathIdentity(pathIdentity));

import { Aether } from "./aether";
import { ROOT_PATH } from "./constants";
import { dataplannerEnforce } from "./dataplannerEnforce";
import { defer, Deferred } from "./deferred";
// Handy for debugging
import { isDev, noop } from "./dev";
import { CrystalError, isCrystalError } from "./error";
import { execute } from "./execute";
import { getCurrentParentPathIdentity } from "./global";
import { InputPlan } from "./input";
import {
  $$bypassGraphQL,
  $$data,
  $$idempotent,
  $$verbatim,
  ArgumentPlanResolver,
  BaseGraphQLArguments,
  BaseGraphQLContext,
  BaseGraphQLRootValue,
  BaseGraphQLVariables,
  CrystalResultsList,
  CrystalResultStreamList,
  CrystalSubscriber,
  CrystalValuesList,
  FieldPlanResolver,
  GraphileFieldConfig,
  GraphileFieldConfigArgumentMap,
  GraphileInputFieldConfig,
  InputObjectFieldPlanResolver,
  NodeIdCodec,
  NodeIdHandler,
  OutputPlanForType,
  PlanOptimizeOptions,
  PlanStreamOptions,
  PolymorphicData,
  PromiseOrDirect,
  TrackedArguments,
} from "./interfaces";
import {
  assertListCapablePlan,
  BasePlan,
  ExecutablePlan,
  isExecutablePlan,
  isListCapablePlan,
  isModifierPlan,
  isObjectLikePlan,
  isStreamablePlan,
  ListCapablePlan,
  ModifierPlan,
  ObjectLikePlan,
  PolymorphicPlan,
  StreamablePlan,
} from "./plan";
import {
  __InputObjectPlan,
  __InputStaticLeafPlan,
  __ItemPlan,
  __ListTransformPlan,
  __TrackedObjectPlan,
  __ValuePlan,
  access,
  AccessPlan,
  aether,
  connection,
  ConnectionCapablePlan,
  ConnectionPlan,
  constant,
  ConstantPlan,
  context,
  debugPlans,
  each,
  EdgeCapablePlan,
  EdgePlan,
  filter,
  first,
  FirstPlan,
  groupBy,
  lambda,
  LambdaPlan,
  last,
  LastPlan,
  list,
  ListPlan,
  listTransform,
  makeMapper,
  map,
  MapPlan,
  node,
  NodePlan,
  object,
  ObjectPlan,
  PageInfoCapablePlan,
  partitionByIndex,
  reverse,
  reverseArray,
  ReversePlan,
  subscribe,
  SubscribePlan,
} from "./plans";
import { __InputListPlan } from "./plans/__inputList";
import { polymorphicWrap, resolveType } from "./polymorphic";
import {
  bypassGraphQLExecute,
  CrystalPrepareOptions,
  dataplannerPrepare,
} from "./prepare";
import {
  $$crystalWrapped,
  crystalResolve,
  dataplannerResolver,
  dataplannerSubscriber,
  isCrystalWrapped,
} from "./resolvers";
import { stripAnsi } from "./stripAnsi";
import {
  arraysMatch,
  getEnumValueConfig,
  GraphileInputFieldConfigMap,
  GraphileInputObjectType,
  GraphileObjectType,
  inputObjectFieldSpec,
  InputObjectTypeSpec,
  isPromiseLike,
  newGraphileFieldConfigBuilder,
  newInputObjectTypeBuilder,
  newObjectTypeBuilder,
  objectFieldSpec,
  objectSpec,
  ObjectTypeSpec,
  planGroupsOverlap,
} from "./utils";

export { isAsyncIterable } from "iterall";
export {
  __InputListPlan,
  __InputObjectPlan,
  __InputStaticLeafPlan,
  __ItemPlan,
  __ListTransformPlan,
  __TrackedObjectPlan,
  __ValuePlan,
  $$bypassGraphQL,
  $$crystalWrapped,
  $$data,
  $$idempotent,
  $$verbatim,
  access,
  AccessPlan,
  Aether,
  aether,
  ArgumentPlanResolver,
  arraysMatch,
  assertListCapablePlan,
  BaseGraphQLArguments,
  BaseGraphQLContext,
  BaseGraphQLRootValue,
  BaseGraphQLVariables,
  BasePlan,
  bypassGraphQLExecute,
  connection,
  ConnectionCapablePlan,
  ConnectionPlan,
  constant,
  ConstantPlan,
  context,
  CrystalError,
  CrystalPrepareOptions,
  crystalPrint,
  crystalPrintPathIdentity,
  crystalResolve,
  CrystalResultsList,
  CrystalResultStreamList,
  CrystalSubscriber,
  CrystalValuesList,
  dataplannerEnforce,
  dataplannerPrepare,
  dataplannerResolver,
  dataplannerSubscriber,
  debugPlans,
  defer,
  Deferred,
  each,
  EdgeCapablePlan,
  EdgePlan,
  ExecutablePlan,
  execute,
  FieldPlanResolver,
  filter,
  first,
  FirstPlan,
  getCurrentParentPathIdentity,
  getEnumValueConfig,
  GraphileFieldConfig,
  GraphileFieldConfigArgumentMap,
  GraphileInputFieldConfig,
  GraphileInputFieldConfigMap,
  GraphileInputObjectType,
  GraphileObjectType,
  groupBy,
  InputObjectFieldPlanResolver,
  inputObjectFieldSpec,
  InputObjectTypeSpec,
  InputPlan,
  isCrystalError,
  isCrystalWrapped,
  isDev,
  isExecutablePlan,
  isListCapablePlan,
  isModifierPlan,
  isObjectLikePlan,
  isPromiseLike,
  isStreamablePlan,
  lambda,
  LambdaPlan,
  last,
  LastPlan,
  list,
  ListCapablePlan,
  ListPlan,
  listTransform,
  makeCrystalSchema,
  makeMapper,
  map,
  MapPlan,
  ModifierPlan,
  newGraphileFieldConfigBuilder,
  newInputObjectTypeBuilder,
  newObjectTypeBuilder,
  node,
  NodeIdCodec,
  NodeIdHandler,
  NodePlan,
  noop,
  object,
  objectFieldSpec,
  ObjectLikePlan,
  ObjectPlan,
  objectSpec,
  ObjectTypeSpec,
  OutputPlanForType,
  PageInfoCapablePlan,
  partitionByIndex,
  planGroupsOverlap,
  PlanOptimizeOptions,
  PlanStreamOptions,
  PolymorphicData,
  PolymorphicPlan,
  polymorphicWrap,
  PromiseOrDirect,
  resolveType,
  reverse,
  reverseArray,
  ReversePlan,
  ROOT_PATH,
  StreamablePlan,
  stripAnsi,
  subscribe,
  SubscribePlan,
  TrackedArguments,
};

exportAsMany({
  crystalPrint,
  crystalPrintPathIdentity,
  makeCrystalSchema,
  Aether,
  ROOT_PATH,
  defer,
  dataplannerEnforce,
  execute,
  __InputListPlan,
  __InputObjectPlan,
  __InputStaticLeafPlan,
  assertListCapablePlan,
  isExecutablePlan,
  isListCapablePlan,
  isModifierPlan,
  isObjectLikePlan,
  isStreamablePlan,
  __ItemPlan,
  __ListTransformPlan,
  __TrackedObjectPlan,
  __ValuePlan,
  access,
  AccessPlan,
  aether,
  connection,
  ConnectionPlan,
  constant,
  ConstantPlan,
  context,
  isCrystalError,
  debugPlans,
  each,
  groupBy,
  filter,
  partitionByIndex,
  listTransform,
  first,
  node,
  NodePlan,
  FirstPlan,
  last,
  LastPlan,
  lambda,
  LambdaPlan,
  list,
  ListPlan,
  makeMapper,
  map,
  MapPlan,
  object,
  ObjectPlan,
  reverse,
  reverseArray,
  ReversePlan,
  subscribe,
  SubscribePlan,
  polymorphicWrap,
  resolveType,
  $$crystalWrapped,
  isCrystalWrapped,
  dataplannerResolver,
  dataplannerPrepare,
  bypassGraphQLExecute,
  crystalResolve,
  dataplannerSubscriber,
  stripAnsi,
  arraysMatch,
  inputObjectFieldSpec,
  newGraphileFieldConfigBuilder,
  newInputObjectTypeBuilder,
  newObjectTypeBuilder,
  objectFieldSpec,
  objectSpec,
  planGroupsOverlap,
  isPromiseLike,
  isDev,
  noop,
  getCurrentParentPathIdentity,
  getEnumValueConfig,
});
