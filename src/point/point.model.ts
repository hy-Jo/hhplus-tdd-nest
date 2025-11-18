export interface UserPoint {
  id: number;
  point: number;
  updateMillis: number;
}

export interface PointHistory {
  id?: number;
  userId: number;
  type: TransactionType;
  amount: number;
  timeMillis: number;
}

export enum TransactionType {
  CHARGE = 'CHARGE',
  USE = 'USE',
}