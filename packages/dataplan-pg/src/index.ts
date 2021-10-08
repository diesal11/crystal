import debugFactory from "debug";
import type { SQL } from "pg-sql2";
import sql from "pg-sql2";

import { formatSQLForDebugging } from "./formatSQLForDebugging";

function sqlPrint(fragment: SQL): string {
  const { text } = sql.compile(fragment);
  return formatSQLForDebugging(text);
}

debugFactory.formatters.S = sqlPrint;

export { enumType, recordType, TYPES } from "./codecs";
export {
  PgSource,
  PgSourceBuilder,
  PgSourceColumn,
  PgSourceColumns,
  PgSourceColumnVia,
  PgSourceColumnViaExplicit,
  PgSourceRelation,
} from "./datasource";
export {
  PgClient,
  PgClientQuery,
  PgExecutor,
  PgExecutorContext,
  PgExecutorContextPlans,
  WithPgClient,
} from "./executor";
export { PgTypeCodec } from "./interfaces";
export { PgSubscriber } from "./PgSubscriber";
export {
  pgClassExpression,
  PgClassExpressionPlan,
} from "./plans/pgClassExpression";
export {
  PgConditionCapableParentPlan,
  PgConditionPlan,
} from "./plans/pgCondition";
export { PgConnectionPlan } from "./plans/pgConnection";
export { pgDelete, PgDeletePlan } from "./plans/pgDelete";
export { pgInsert, PgInsertPlan } from "./plans/pgInsert";
export { pgPolymorphic, PgPolymorphicPlan } from "./plans/pgPolymorphic";
export { pgSelect, PgSelectPlan } from "./plans/pgSelect";
export {
  pgSelectSingleFromRecord,
  PgSelectSinglePlan,
} from "./plans/pgSelectSingle";
export {
  pgSingleTablePolymorphic,
  PgSingleTablePolymorphicPlan,
} from "./plans/pgSingleTablePolymorphic";
export { pgUpdate, PgUpdatePlan } from "./plans/pgUpdate";
