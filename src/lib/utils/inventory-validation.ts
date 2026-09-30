/** Quantities map to PostgreSQL integer; reject decimals instead of silently rounding. */
export function isInventoryInteger(value: unknown, minimum: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= 2147483647
}

export function inventoryRpcError(error: { code?: string; message: string }): string {
  if (error.code === 'PGRST202' || error.code === '42883') {
    return '在庫処理の更新がまだ適用されていません。管理者に確認してください（データは変更されていません）'
  }
  return error.message
}
