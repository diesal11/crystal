// TODO: delete this entire plan; it can be completely replaced with pgClassExpression

import debugFactory from "debug";
import type { CrystalResultsList, CrystalValuesList } from "graphile-crystal";
import { ExecutablePlan } from "graphile-crystal";
import type { SQL } from "pg-sql2";
import sql from "pg-sql2";

import type { PgSource } from "../datasource";
import type { PgTypeCodec, PgTypedExecutablePlan } from "../interfaces";
import { PgSelectSinglePlan } from "./pgSelectSingle";

//const debugPlan = debugFactory("datasource:pg:PgRecordPlan:plan");
const debugExecute = debugFactory("datasource:pg:PgRecordPlan:execute");
//const debugPlanVerbose = debugPlan.extend("verbose");
const debugExecuteVerbose = debugExecute.extend("verbose");

/**
 * This plan resolves to an entire record (e.g. a row from a table); useful for
 * example when you need to feed an entire record into something in Postgres,
 * for example into the first argument to a PostGraphile-style computed column
 * function.
 */
export class PgRecordPlan<TDataSource extends PgSource<any, any, any, any>>
  extends ExecutablePlan<any>
  implements PgTypedExecutablePlan<TDataSource["codec"]>
{
  public readonly pgCodec: TDataSource["codec"];
  public readonly expression: SQL;
  public readonly tableId: number;

  /**
   * This is the numeric index of this expression within the grandparent
   * PgSelectPlan's selection.
   */
  private attrIndex: number | null = null;

  public readonly dataSource: TDataSource;

  constructor(
    table: PgSelectSinglePlan<TDataSource>,
    pgCodec: PgTypeCodec,
    expression: SQL,
  ) {
    super();
    this.dataSource = table.dataSource;
    this.pgCodec = pgCodec;
    this.expression = expression;
    this.tableId = this.addDependency(table);
  }

  public getClassSinglePlan(): PgSelectSinglePlan<TDataSource> {
    const plan = this.getPlan(this.dependencies[this.tableId]);
    if (!(plan instanceof PgSelectSinglePlan)) {
      throw new Error(`Expected ${plan} to be a PgSelectSinglePlan`);
    }
    return plan;
  }

  public optimize(): this {
    const $table = this.getClassSinglePlan().getClassPlan();
    this.attrIndex = $table.select(sql`${this.expression}::text`);
    return this;
  }

  public execute(
    values: CrystalValuesList<any[]>,
  ): CrystalResultsList<string | null> {
    const { attrIndex, tableId } = this;
    if (attrIndex != null) {
      const result = values.map((v) => {
        const rawValue = v[tableId][attrIndex];
        if (rawValue == null) {
          return null;
        } else {
          return rawValue;
        }
      });
      debugExecuteVerbose("%s values: %c, result: %c", this, values, result);
      return result;
    } else {
      throw new Error(
        "Cannot execute PgRecordPlan without first optimizing it",
      );
    }
  }

  public deduplicate(
    peers: Array<PgRecordPlan<TDataSource>>,
  ): PgRecordPlan<TDataSource> {
    const equivalentPeer = peers.find(
      (peer) =>
        peer.pgCodec === this.pgCodec &&
        sql.isEquivalent(peer.expression, this.expression),
    );
    return equivalentPeer ?? this;
  }

  public toSQL(): SQL {
    return this.expression;
  }
}

function pgRecord<TDataSource extends PgSource<any, any, any, any>>(
  table: PgSelectSinglePlan<TDataSource>,
  pgCodec: PgTypeCodec,
  expression: SQL,
): PgRecordPlan<TDataSource> {
  return new PgRecordPlan(table, pgCodec, expression);
}

export { pgRecord };
