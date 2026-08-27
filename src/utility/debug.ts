type MatchableResult<T, E> = {
  match: <U>(
    onOk: (value: T) => U | Promise<U>,
    onErr: (error: E) => U | Promise<U>,
  ) => U | Promise<U>;
};

export const logValue = <T>(label: string, value: T): T => {
  console.log(label);

  if (value !== undefined) {
    console.dir(value, { depth: null });
  }

  return value;
};

export const unwrapAndLogResult = async <T, E>(
  result: MatchableResult<T, E>,
  label: string,
) => {
  const value = await result.match(
    (output) => logValue(label, output),
    (error) => {
      logValue(`${label}.error`, error);

      throw new Error(String(error));
    },
  );

  return value;
};
