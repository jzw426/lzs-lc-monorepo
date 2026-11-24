export interface UnitDefinition {
  readonly id: string;
  readonly name: '刀' | '枪' | '骑' | '弓';
  readonly attack: number;
  readonly maxHealth: number;
}

export interface ContentBundle {
  readonly contentVersion: string;
  readonly rulesVersion: string;
  readonly configHash: string;
  readonly tickRate: 30;
  readonly economy: {
    readonly initialGrain: number;
    readonly barracksCapacity: number;
    readonly recruitCost: number;
  };
  readonly units: readonly UnitDefinition[];
}
