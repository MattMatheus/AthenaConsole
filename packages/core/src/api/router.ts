export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export type RouteParams = Record<string, string>;

export interface RouteDefinition<TContext, TMeta = undefined> {
  method: HttpMethod;
  path: string;
  handler: (context: TContext, params: RouteParams) => Promise<void> | void;
  meta?: TMeta;
}

export type RouteTable<TContext, TMeta = undefined> = ReadonlyArray<RouteDefinition<TContext, TMeta>>;

interface CompiledRoute<TContext, TMeta> {
  route: RouteDefinition<TContext, TMeta>;
  segments: string[];
}

export interface RouteMatch<TContext, TMeta = undefined> {
  route: RouteDefinition<TContext, TMeta>;
  params: RouteParams;
}

export class APIRouter<TContext, TMeta = undefined> {
  private readonly compiledRoutes: CompiledRoute<TContext, TMeta>[];

  constructor(private readonly routes: RouteTable<TContext, TMeta>) {
    this.compiledRoutes = routes
      .map((route) => ({
        route,
        segments: splitPath(route.path)
      }))
      .sort(compareCompiledRoutes);
  }

  findMatch(method: string, path: string): RouteMatch<TContext, TMeta> | undefined {
    for (const compiled of this.compiledRoutes) {
      if (compiled.route.method !== method) {
        continue;
      }
      const params = matchPath(compiled.segments, path);
      if (params) {
        return {
          route: compiled.route,
          params
        };
      }
    }
    return undefined;
  }

  async dispatch(request: { method: string; path: string; context: TContext }): Promise<boolean> {
    const match = this.findMatch(request.method, request.path);
    if (!match) {
      return false;
    }
    await match.route.handler(request.context, match.params);
    return true;
  }
}

function compareCompiledRoutes<TContext, TMeta>(
  left: CompiledRoute<TContext, TMeta>,
  right: CompiledRoute<TContext, TMeta>
): number {
  const methodOrder = compareAscii(left.route.method, right.route.method);
  if (methodOrder !== 0) {
    return methodOrder;
  }

  const maxSegments = Math.max(left.segments.length, right.segments.length);
  for (let index = 0; index < maxSegments; index += 1) {
    const leftSegment = left.segments[index];
    const rightSegment = right.segments[index];
    if (leftSegment === undefined || rightSegment === undefined) {
      if (leftSegment === undefined && rightSegment === undefined) {
        break;
      }
      return leftSegment === undefined ? 1 : -1;
    }

    const leftParam = leftSegment.startsWith(":");
    const rightParam = rightSegment.startsWith(":");
    if (leftParam !== rightParam) {
      return leftParam ? 1 : -1;
    }

    const segmentOrder = compareAscii(leftSegment, rightSegment);
    if (segmentOrder !== 0) {
      return segmentOrder;
    }
  }

  return compareAscii(left.route.path, right.route.path);
}

function compareAscii(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function splitPath(path: string): string[] {
  return path.split("/").filter((segment) => segment.length > 0);
}

function matchPath(routeSegments: string[], candidatePath: string): RouteParams | undefined {
  const candidateSegments = splitPath(candidatePath);
  if (candidateSegments.length !== routeSegments.length) {
    return undefined;
  }

  const params: RouteParams = {};
  for (let index = 0; index < routeSegments.length; index += 1) {
    const routeSegment = routeSegments[index];
    const candidateSegment = candidateSegments[index];
    if (!routeSegment || !candidateSegment) {
      return undefined;
    }
    if (routeSegment.startsWith(":")) {
      const key = routeSegment.slice(1);
      if (!key) {
        return undefined;
      }
      params[key] = candidateSegment;
      continue;
    }
    if (routeSegment !== candidateSegment) {
      return undefined;
    }
  }

  return params;
}
