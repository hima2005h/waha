export function CacheAsync() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const original = descriptor.value;

    const symbol = Symbol(`__cache_${propertyKey}`);

    descriptor.value = async function (...args: any[]) {
      const key = symbol;

      if (this[key]) {
        return this[key];
      }

      const result = await original.apply(this, args);
      this[key] = result;
      return result;
    };
  };
}
