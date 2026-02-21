declare module "ioredis" {
  interface RedisConstructor {
    new (url: string, options?: Record<string, unknown>): unknown;
  }

  const Redis: RedisConstructor;
  export default Redis;
}
