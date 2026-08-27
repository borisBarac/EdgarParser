export const sortByOrderInFile = <T extends { readonly orderInFile: number }>(
  values: readonly T[],
): readonly T[] =>
  [...values].sort((left, right) => left.orderInFile - right.orderInFile);
