/* eslint-disable */

import { AllTypesProps, ReturnTypes, Ops } from './const';
export const HOST = 'https://api.cyanite.ai/graphql';

export const HEADERS = {};
export const apiSubscription = (options: chainOptions) => (query: string) => {
  try {
    const queryString = options[0] + '?query=' + encodeURIComponent(query);
    const wsString = queryString.replace('http', 'ws');
    const host = (options.length > 1 && options[1]?.websocket?.[0]) || wsString;
    const webSocketOptions = options[1]?.websocket || [host];
    const ws = new WebSocket(...webSocketOptions);
    return {
      ws,
      on: (e: (args: any) => void) => {
        ws.onmessage = (event: any) => {
          if (event.data) {
            const parsed = JSON.parse(event.data);
            const data = parsed.data;
            return e(data);
          }
        };
      },
      off: (e: (args: any) => void) => {
        ws.onclose = e;
      },
      error: (e: (args: any) => void) => {
        ws.onerror = e;
      },
      open: (e: () => void) => {
        ws.onopen = e;
      },
    };
  } catch {
    throw new Error('No websockets implemented');
  }
};
const handleFetchResponse = (response: Response): Promise<GraphQLResponse> => {
  if (!response.ok) {
    return new Promise((_, reject) => {
      response
        .text()
        .then((text) => {
          try {
            reject(JSON.parse(text));
          } catch (err) {
            reject(text);
          }
        })
        .catch(reject);
    });
  }
  return response.json() as Promise<GraphQLResponse>;
};

export const apiFetch =
  (options: fetchOptions) =>
  (query: string, variables: Record<string, unknown> = {}) => {
    const fetchOptions = options[1] || {};
    if (fetchOptions.method && fetchOptions.method === 'GET') {
      return fetch(
        `${options[0]}?query=${encodeURIComponent(query)}`,
        fetchOptions,
      )
        .then(handleFetchResponse)
        .then((response: GraphQLResponse) => {
          if (response.errors) {
            throw new GraphQLError(response);
          }
          return response.data;
        });
    }
    return fetch(`${options[0]}`, {
      body: JSON.stringify({ query, variables }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      ...fetchOptions,
    })
      .then(handleFetchResponse)
      .then((response: GraphQLResponse) => {
        if (response.errors) {
          throw new GraphQLError(response);
        }
        return response.data;
      });
  };

export const InternalsBuildQuery = ({
  ops,
  props,
  returns,
  options,
  scalars,
}: {
  props: AllTypesPropsType;
  returns: ReturnTypesType;
  ops: Operations;
  options?: OperationOptions;
  scalars?: ScalarDefinition;
}) => {
  const ibb = (
    k: string,
    o: InputValueType | VType,
    p = '',
    root = true,
    vars: Array<{ name: string; graphQLType: string }> = [],
  ): string => {
    const keyForPath = purifyGraphQLKey(k);
    const newPath = [p, keyForPath].join(SEPARATOR);
    if (!o) {
      return '';
    }
    if (typeof o === 'boolean' || typeof o === 'number') {
      return k;
    }
    if (typeof o === 'string') {
      return `${k} ${o}`;
    }
    if (Array.isArray(o)) {
      const args = InternalArgsBuilt({
        props,
        returns,
        ops,
        scalars,
        vars,
      })(o[0], newPath);
      return `${ibb(args ? `${k}(${args})` : k, o[1], p, false, vars)}`;
    }
    if (k === '__alias') {
      return Object.entries(o)
        .map(([alias, objectUnderAlias]) => {
          if (
            typeof objectUnderAlias !== 'object' ||
            Array.isArray(objectUnderAlias)
          ) {
            throw new Error(
              'Invalid alias it should be __alias:{ YOUR_ALIAS_NAME: { OPERATION_NAME: { ...selectors }}}',
            );
          }
          const operationName = Object.keys(objectUnderAlias)[0];
          const operation = objectUnderAlias[operationName];
          return ibb(`${alias}:${operationName}`, operation, p, false, vars);
        })
        .join('\n');
    }
    const hasOperationName =
      root && options?.operationName ? ' ' + options.operationName : '';
    const keyForDirectives = o.__directives ?? '';
    const query = `{${Object.entries(o)
      .filter(([k]) => k !== '__directives')
      .map((e) =>
        ibb(...e, [p, `field<>${keyForPath}`].join(SEPARATOR), false, vars),
      )
      .join('\n')}}`;
    if (!root) {
      return `${k} ${keyForDirectives}${hasOperationName} ${query}`;
    }
    const varsString = vars
      .map((v) => `${v.name}: ${v.graphQLType}`)
      .join(', ');
    return `${k} ${keyForDirectives}${hasOperationName}${
      varsString ? `(${varsString})` : ''
    } ${query}`;
  };
  return ibb;
};

export const Thunder =
  (fn: FetchFunction) =>
  <
    O extends keyof typeof Ops,
    SCLR extends ScalarDefinition,
    R extends keyof ValueTypes = GenericOperation<O>,
  >(
    operation: O,
    graphqlOptions?: ThunderGraphQLOptions<SCLR>,
  ) =>
  <Z extends ValueTypes[R]>(
    o: (Z & ValueTypes[R]) | ValueTypes[R],
    ops?: OperationOptions & { variables?: Record<string, unknown> },
  ) =>
    fn(
      Zeus(operation, o, {
        operationOptions: ops,
        scalars: graphqlOptions?.scalars,
      }),
      ops?.variables,
    ).then((data) => {
      if (graphqlOptions?.scalars) {
        return decodeScalarsInResponse({
          response: data,
          initialOp: operation,
          initialZeusQuery: o as VType,
          returns: ReturnTypes,
          scalars: graphqlOptions.scalars,
          ops: Ops,
        });
      }
      return data;
    }) as Promise<InputType<GraphQLTypes[R], Z, SCLR>>;

export const Chain = (...options: chainOptions) => Thunder(apiFetch(options));

export const SubscriptionThunder =
  (fn: SubscriptionFunction) =>
  <
    O extends keyof typeof Ops,
    SCLR extends ScalarDefinition,
    R extends keyof ValueTypes = GenericOperation<O>,
  >(
    operation: O,
    graphqlOptions?: ThunderGraphQLOptions<SCLR>,
  ) =>
  <Z extends ValueTypes[R]>(
    o: (Z & ValueTypes[R]) | ValueTypes[R],
    ops?: OperationOptions & { variables?: ExtractVariables<Z> },
  ) => {
    const returnedFunction = fn(
      Zeus(operation, o, {
        operationOptions: ops,
        scalars: graphqlOptions?.scalars,
      }),
    ) as SubscriptionToGraphQL<Z, GraphQLTypes[R], SCLR>;
    if (returnedFunction?.on && graphqlOptions?.scalars) {
      const wrapped = returnedFunction.on;
      returnedFunction.on = (
        fnToCall: (args: InputType<GraphQLTypes[R], Z, SCLR>) => void,
      ) =>
        wrapped((data: InputType<GraphQLTypes[R], Z, SCLR>) => {
          if (graphqlOptions?.scalars) {
            return fnToCall(
              decodeScalarsInResponse({
                response: data,
                initialOp: operation,
                initialZeusQuery: o as VType,
                returns: ReturnTypes,
                scalars: graphqlOptions.scalars,
                ops: Ops,
              }),
            );
          }
          return fnToCall(data);
        });
    }
    return returnedFunction;
  };

export const Subscription = (...options: chainOptions) =>
  SubscriptionThunder(apiSubscription(options));
export const Zeus = <
  Z extends ValueTypes[R],
  O extends keyof typeof Ops,
  R extends keyof ValueTypes = GenericOperation<O>,
>(
  operation: O,
  o: (Z & ValueTypes[R]) | ValueTypes[R],
  ops?: {
    operationOptions?: OperationOptions;
    scalars?: ScalarDefinition;
  },
) =>
  InternalsBuildQuery({
    props: AllTypesProps,
    returns: ReturnTypes,
    ops: Ops,
    options: ops?.operationOptions,
    scalars: ops?.scalars,
  })(operation, o as VType);

export const ZeusSelect = <T>() => ((t: unknown) => t) as SelectionFunction<T>;

export const Selector = <T extends keyof ValueTypes>(key: T) =>
  key && ZeusSelect<ValueTypes[T]>();

export const TypeFromSelector = <T extends keyof ValueTypes>(key: T) =>
  key && ZeusSelect<ValueTypes[T]>();
export const Gql = Chain(HOST, {
  headers: {
    'Content-Type': 'application/json',
    ...HEADERS,
  },
});

export const ZeusScalars = ZeusSelect<ScalarCoders>();

export const decodeScalarsInResponse = <O extends Operations>({
  response,
  scalars,
  returns,
  ops,
  initialZeusQuery,
  initialOp,
}: {
  ops: O;
  response: any;
  returns: ReturnTypesType;
  scalars?: Record<string, ScalarResolver | undefined>;
  initialOp: keyof O;
  initialZeusQuery: InputValueType | VType;
}) => {
  if (!scalars) {
    return response;
  }
  const builder = PrepareScalarPaths({
    ops,
    returns,
  });

  const scalarPaths = builder(
    initialOp as string,
    ops[initialOp],
    initialZeusQuery,
  );
  if (scalarPaths) {
    const r = traverseResponse({ scalarPaths, resolvers: scalars })(
      initialOp as string,
      response,
      [ops[initialOp]],
    );
    return r;
  }
  return response;
};

export const traverseResponse = ({
  resolvers,
  scalarPaths,
}: {
  scalarPaths: { [x: string]: `scalar.${string}` };
  resolvers: {
    [x: string]: ScalarResolver | undefined;
  };
}) => {
  const ibb = (
    k: string,
    o: InputValueType | VType,
    p: string[] = [],
  ): unknown => {
    if (Array.isArray(o)) {
      return o.map((eachO) => ibb(k, eachO, p));
    }
    if (o == null) {
      return o;
    }
    const scalarPathString = p.join(SEPARATOR);
    const currentScalarString = scalarPaths[scalarPathString];
    if (currentScalarString) {
      const currentDecoder =
        resolvers[currentScalarString.split('.')[1]]?.decode;
      if (currentDecoder) {
        return currentDecoder(o);
      }
    }
    if (
      typeof o === 'boolean' ||
      typeof o === 'number' ||
      typeof o === 'string' ||
      !o
    ) {
      return o;
    }
    const entries = Object.entries(o).map(
      ([k, v]) => [k, ibb(k, v, [...p, purifyGraphQLKey(k)])] as const,
    );
    const objectFromEntries = entries.reduce<Record<string, unknown>>(
      (a, [k, v]) => {
        a[k] = v;
        return a;
      },
      {},
    );
    return objectFromEntries;
  };
  return ibb;
};

export type AllTypesPropsType = {
  [x: string]:
    | undefined
    | `scalar.${string}`
    | 'enum'
    | {
        [x: string]:
          | undefined
          | string
          | {
              [x: string]: string | undefined;
            };
      };
};

export type ReturnTypesType = {
  [x: string]:
    | {
        [x: string]: string | undefined;
      }
    | `scalar.${string}`
    | undefined;
};
export type InputValueType = {
  [x: string]:
    | undefined
    | boolean
    | string
    | number
    | [any, undefined | boolean | InputValueType]
    | InputValueType;
};
export type VType =
  | undefined
  | boolean
  | string
  | number
  | [any, undefined | boolean | InputValueType]
  | InputValueType;

export type PlainType = boolean | number | string | null | undefined;
export type ZeusArgsType =
  | PlainType
  | {
      [x: string]: ZeusArgsType;
    }
  | Array<ZeusArgsType>;

export type Operations = Record<string, string>;

export type VariableDefinition = {
  [x: string]: unknown;
};

export const SEPARATOR = '|';

export type fetchOptions = Parameters<typeof fetch>;
type websocketOptions = typeof WebSocket extends new (
  ...args: infer R
) => WebSocket
  ? R
  : never;
export type chainOptions =
  | [fetchOptions[0], fetchOptions[1] & { websocket?: websocketOptions }]
  | [fetchOptions[0]];
export type FetchFunction = (
  query: string,
  variables?: Record<string, unknown>,
) => Promise<any>;
export type SubscriptionFunction = (query: string) => any;
type NotUndefined<T> = T extends undefined ? never : T;
export type ResolverType<F> = NotUndefined<
  F extends [infer ARGS, any] ? ARGS : undefined
>;

export type OperationOptions = {
  operationName?: string;
};

export type ScalarCoder = Record<string, (s: unknown) => string>;

export interface GraphQLResponse {
  data?: Record<string, any>;
  errors?: Array<{
    message: string;
  }>;
}
export class GraphQLError extends Error {
  constructor(public response: GraphQLResponse) {
    super('');
    console.error(response);
  }
  toString() {
    return 'GraphQL Response Error';
  }
}
export type GenericOperation<O> = O extends keyof typeof Ops
  ? (typeof Ops)[O]
  : never;
export type ThunderGraphQLOptions<SCLR extends ScalarDefinition> = {
  scalars?: SCLR | ScalarCoders;
};

const ExtractScalar = (
  mappedParts: string[],
  returns: ReturnTypesType,
): `scalar.${string}` | undefined => {
  if (mappedParts.length === 0) {
    return;
  }
  const oKey = mappedParts[0];
  const returnP1 = returns[oKey];
  if (typeof returnP1 === 'object') {
    const returnP2 = returnP1[mappedParts[1]];
    if (returnP2) {
      return ExtractScalar([returnP2, ...mappedParts.slice(2)], returns);
    }
    return undefined;
  }
  return returnP1 as `scalar.${string}` | undefined;
};

export const PrepareScalarPaths = ({
  ops,
  returns,
}: {
  returns: ReturnTypesType;
  ops: Operations;
}) => {
  const ibb = (
    k: string,
    originalKey: string,
    o: InputValueType | VType,
    p: string[] = [],
    pOriginals: string[] = [],
    root = true,
  ): { [x: string]: `scalar.${string}` } | undefined => {
    if (!o) {
      return;
    }
    if (
      typeof o === 'boolean' ||
      typeof o === 'number' ||
      typeof o === 'string'
    ) {
      const extractionArray = [...pOriginals, originalKey];
      const isScalar = ExtractScalar(extractionArray, returns);
      if (isScalar?.startsWith('scalar')) {
        const partOfTree = {
          [[...p, k].join(SEPARATOR)]: isScalar,
        };
        return partOfTree;
      }
      return {};
    }
    if (Array.isArray(o)) {
      return ibb(k, k, o[1], p, pOriginals, false);
    }
    if (k === '__alias') {
      return Object.entries(o)
        .map(([alias, objectUnderAlias]) => {
          if (
            typeof objectUnderAlias !== 'object' ||
            Array.isArray(objectUnderAlias)
          ) {
            throw new Error(
              'Invalid alias it should be __alias:{ YOUR_ALIAS_NAME: { OPERATION_NAME: { ...selectors }}}',
            );
          }
          const operationName = Object.keys(objectUnderAlias)[0];
          const operation = objectUnderAlias[operationName];
          return ibb(alias, operationName, operation, p, pOriginals, false);
        })
        .reduce((a, b) => ({
          ...a,
          ...b,
        }));
    }
    const keyName = root ? ops[k] : k;
    return Object.entries(o)
      .filter(([k]) => k !== '__directives')
      .map(([k, v]) => {
        // Inline fragments shouldn't be added to the path as they aren't a field
        const isInlineFragment = originalKey.match(/^...\s*on/) != null;
        return ibb(
          k,
          k,
          v,
          isInlineFragment ? p : [...p, purifyGraphQLKey(keyName || k)],
          isInlineFragment
            ? pOriginals
            : [...pOriginals, purifyGraphQLKey(originalKey)],
          false,
        );
      })
      .reduce((a, b) => ({
        ...a,
        ...b,
      }));
  };
  return ibb;
};

export const purifyGraphQLKey = (k: string) =>
  k.replace(/\([^)]*\)/g, '').replace(/^[^:]*\:/g, '');

const mapPart = (p: string) => {
  const [isArg, isField] = p.split('<>');
  if (isField) {
    return {
      v: isField,
      __type: 'field',
    } as const;
  }
  return {
    v: isArg,
    __type: 'arg',
  } as const;
};

type Part = ReturnType<typeof mapPart>;

export const ResolveFromPath = (
  props: AllTypesPropsType,
  returns: ReturnTypesType,
  ops: Operations,
) => {
  const ResolvePropsType = (mappedParts: Part[]) => {
    const oKey = ops[mappedParts[0].v];
    const propsP1 = oKey ? props[oKey] : props[mappedParts[0].v];
    if (propsP1 === 'enum' && mappedParts.length === 1) {
      return 'enum';
    }
    if (
      typeof propsP1 === 'string' &&
      propsP1.startsWith('scalar.') &&
      mappedParts.length === 1
    ) {
      return propsP1;
    }
    if (typeof propsP1 === 'object') {
      if (mappedParts.length < 2) {
        return 'not';
      }
      const propsP2 = propsP1[mappedParts[1].v];
      if (typeof propsP2 === 'string') {
        return rpp(
          `${propsP2}${SEPARATOR}${mappedParts
            .slice(2)
            .map((mp) => mp.v)
            .join(SEPARATOR)}`,
        );
      }
      if (typeof propsP2 === 'object') {
        if (mappedParts.length < 3) {
          return 'not';
        }
        const propsP3 = propsP2[mappedParts[2].v];
        if (propsP3 && mappedParts[2].__type === 'arg') {
          return rpp(
            `${propsP3}${SEPARATOR}${mappedParts
              .slice(3)
              .map((mp) => mp.v)
              .join(SEPARATOR)}`,
          );
        }
      }
    }
  };
  const ResolveReturnType = (mappedParts: Part[]) => {
    if (mappedParts.length === 0) {
      return 'not';
    }
    const oKey = ops[mappedParts[0].v];
    const returnP1 = oKey ? returns[oKey] : returns[mappedParts[0].v];
    if (typeof returnP1 === 'object') {
      if (mappedParts.length < 2) return 'not';
      const returnP2 = returnP1[mappedParts[1].v];
      if (returnP2) {
        return rpp(
          `${returnP2}${SEPARATOR}${mappedParts
            .slice(2)
            .map((mp) => mp.v)
            .join(SEPARATOR)}`,
        );
      }
    }
  };
  const rpp = (path: string): 'enum' | 'not' | `scalar.${string}` => {
    const parts = path.split(SEPARATOR).filter((l) => l.length > 0);
    const mappedParts = parts.map(mapPart);
    const propsP1 = ResolvePropsType(mappedParts);
    if (propsP1) {
      return propsP1;
    }
    const returnP1 = ResolveReturnType(mappedParts);
    if (returnP1) {
      return returnP1;
    }
    return 'not';
  };
  return rpp;
};

export const InternalArgsBuilt = ({
  props,
  ops,
  returns,
  scalars,
  vars,
}: {
  props: AllTypesPropsType;
  returns: ReturnTypesType;
  ops: Operations;
  scalars?: ScalarDefinition;
  vars: Array<{ name: string; graphQLType: string }>;
}) => {
  const arb = (a: ZeusArgsType, p = '', root = true): string => {
    if (typeof a === 'string') {
      if (a.startsWith(START_VAR_NAME)) {
        const [varName, graphQLType] = a
          .replace(START_VAR_NAME, '$')
          .split(GRAPHQL_TYPE_SEPARATOR);
        const v = vars.find((v) => v.name === varName);
        if (!v) {
          vars.push({
            name: varName,
            graphQLType,
          });
        } else {
          if (v.graphQLType !== graphQLType) {
            throw new Error(
              `Invalid variable exists with two different GraphQL Types, "${v.graphQLType}" and ${graphQLType}`,
            );
          }
        }
        return varName;
      }
    }
    const checkType = ResolveFromPath(props, returns, ops)(p);
    if (checkType.startsWith('scalar.')) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [_, ...splittedScalar] = checkType.split('.');
      const scalarKey = splittedScalar.join('.');
      return (scalars?.[scalarKey]?.encode?.(a) as string) || JSON.stringify(a);
    }
    if (Array.isArray(a)) {
      return `[${a.map((arr) => arb(arr, p, false)).join(', ')}]`;
    }
    if (typeof a === 'string') {
      if (checkType === 'enum') {
        return a;
      }
      return `${JSON.stringify(a)}`;
    }
    if (typeof a === 'object') {
      if (a === null) {
        return `null`;
      }
      const returnedObjectString = Object.entries(a)
        .filter(([, v]) => typeof v !== 'undefined')
        .map(([k, v]) => `${k}: ${arb(v, [p, k].join(SEPARATOR), false)}`)
        .join(',\n');
      if (!root) {
        return `{${returnedObjectString}}`;
      }
      return returnedObjectString;
    }
    return `${a}`;
  };
  return arb;
};

export const resolverFor = <
  X,
  T extends keyof ResolverInputTypes,
  Z extends keyof ResolverInputTypes[T],
>(
  type: T,
  field: Z,
  fn: (
    args: Required<ResolverInputTypes[T]>[Z] extends [infer Input, any]
      ? Input
      : any,
    source: any,
  ) => Z extends keyof ModelTypes[T]
    ? ModelTypes[T][Z] | Promise<ModelTypes[T][Z]> | X
    : never,
) => fn as (args?: any, source?: any) => ReturnType<typeof fn>;

export type UnwrapPromise<T> = T extends Promise<infer R> ? R : T;
export type ZeusState<T extends (...args: any[]) => Promise<any>> = NonNullable<
  UnwrapPromise<ReturnType<T>>
>;
export type ZeusHook<
  T extends (
    ...args: any[]
  ) => Record<string, (...args: any[]) => Promise<any>>,
  N extends keyof ReturnType<T>,
> = ZeusState<ReturnType<T>[N]>;

export type WithTypeNameValue<T> = T & {
  __typename?: boolean;
  __directives?: string;
};
export type AliasType<T> = WithTypeNameValue<T> & {
  __alias?: Record<string, WithTypeNameValue<T>>;
};
type DeepAnify<T> = {
  [P in keyof T]?: any;
};
type IsPayLoad<T> = T extends [any, infer PayLoad] ? PayLoad : T;
export type ScalarDefinition = Record<string, ScalarResolver>;

type IsScalar<S, SCLR extends ScalarDefinition> = S extends 'scalar' & {
  name: infer T;
}
  ? T extends keyof SCLR
    ? SCLR[T]['decode'] extends (s: unknown) => unknown
      ? ReturnType<SCLR[T]['decode']>
      : unknown
    : unknown
  : S;
type IsArray<T, U, SCLR extends ScalarDefinition> = T extends Array<infer R>
  ? InputType<R, U, SCLR>[]
  : InputType<T, U, SCLR>;
type FlattenArray<T> = T extends Array<infer R> ? R : T;
type BaseZeusResolver = boolean | 1 | string | Variable<any, string>;

type IsInterfaced<
  SRC extends DeepAnify<DST>,
  DST,
  SCLR extends ScalarDefinition,
> = FlattenArray<SRC> extends ZEUS_INTERFACES | ZEUS_UNIONS
  ? {
      [P in keyof SRC]: SRC[P] extends '__union' & infer R
        ? P extends keyof DST
          ? IsArray<
              R,
              '__typename' extends keyof DST
                ? DST[P] & { __typename: true }
                : DST[P],
              SCLR
            >
          : IsArray<
              R,
              '__typename' extends keyof DST
                ? { __typename: true }
                : Record<string, never>,
              SCLR
            >
        : never;
    }[keyof SRC] & {
      [P in keyof Omit<
        Pick<
          SRC,
          {
            [P in keyof DST]: SRC[P] extends '__union' & infer R ? never : P;
          }[keyof DST]
        >,
        '__typename'
      >]: IsPayLoad<DST[P]> extends BaseZeusResolver
        ? IsScalar<SRC[P], SCLR>
        : IsArray<SRC[P], DST[P], SCLR>;
    }
  : {
      [P in keyof Pick<SRC, keyof DST>]: IsPayLoad<
        DST[P]
      > extends BaseZeusResolver
        ? IsScalar<SRC[P], SCLR>
        : IsArray<SRC[P], DST[P], SCLR>;
    };

export type MapType<
  SRC,
  DST,
  SCLR extends ScalarDefinition,
> = SRC extends DeepAnify<DST> ? IsInterfaced<SRC, DST, SCLR> : never;
// eslint-disable-next-line @typescript-eslint/ban-types
export type InputType<
  SRC,
  DST,
  SCLR extends ScalarDefinition = {},
> = IsPayLoad<DST> extends { __alias: infer R }
  ? {
      [P in keyof R]: MapType<SRC, R[P], SCLR>[keyof MapType<SRC, R[P], SCLR>];
    } & MapType<SRC, Omit<IsPayLoad<DST>, '__alias'>, SCLR>
  : MapType<SRC, IsPayLoad<DST>, SCLR>;
export type SubscriptionToGraphQL<Z, T, SCLR extends ScalarDefinition> = {
  ws: WebSocket;
  on: (fn: (args: InputType<T, Z, SCLR>) => void) => void;
  off: (
    fn: (e: {
      data?: InputType<T, Z, SCLR>;
      code?: number;
      reason?: string;
      message?: string;
    }) => void,
  ) => void;
  error: (
    fn: (e: { data?: InputType<T, Z, SCLR>; errors?: string[] }) => void,
  ) => void;
  open: () => void;
};

// eslint-disable-next-line @typescript-eslint/ban-types
export type FromSelector<
  SELECTOR,
  NAME extends keyof GraphQLTypes,
  SCLR extends ScalarDefinition = {},
> = InputType<GraphQLTypes[NAME], SELECTOR, SCLR>;

export type ScalarResolver = {
  encode?: (s: unknown) => string;
  decode?: (s: unknown) => unknown;
};

export type SelectionFunction<V> = <T>(t: T | V) => T;

type BuiltInVariableTypes = {
  ['String']: string;
  ['Int']: number;
  ['Float']: number;
  ['ID']: unknown;
  ['Boolean']: boolean;
};
type AllVariableTypes = keyof BuiltInVariableTypes | keyof ZEUS_VARIABLES;
type VariableRequired<T extends string> =
  | `${T}!`
  | T
  | `[${T}]`
  | `[${T}]!`
  | `[${T}!]`
  | `[${T}!]!`;
type VR<T extends string> = VariableRequired<VariableRequired<T>>;

export type GraphQLVariableType = VR<AllVariableTypes>;

type ExtractVariableTypeString<T extends string> = T extends VR<infer R1>
  ? R1 extends VR<infer R2>
    ? R2 extends VR<infer R3>
      ? R3 extends VR<infer R4>
        ? R4 extends VR<infer R5>
          ? R5
          : R4
        : R3
      : R2
    : R1
  : T;

type DecomposeType<T, Type> = T extends `[${infer R}]`
  ? Array<DecomposeType<R, Type>> | undefined
  : T extends `${infer R}!`
    ? NonNullable<DecomposeType<R, Type>>
    : Type | undefined;

type ExtractTypeFromGraphQLType<T extends string> =
  T extends keyof ZEUS_VARIABLES
    ? ZEUS_VARIABLES[T]
    : T extends keyof BuiltInVariableTypes
      ? BuiltInVariableTypes[T]
      : any;

export type GetVariableType<T extends string> = DecomposeType<
  T,
  ExtractTypeFromGraphQLType<ExtractVariableTypeString<T>>
>;

type UndefinedKeys<T> = {
  [K in keyof T]-?: T[K] extends NonNullable<T[K]> ? never : K;
}[keyof T];

type WithNullableKeys<T> = Pick<T, UndefinedKeys<T>>;
type WithNonNullableKeys<T> = Omit<T, UndefinedKeys<T>>;

type OptionalKeys<T> = {
  [P in keyof T]?: T[P];
};

export type WithOptionalNullables<T> = OptionalKeys<WithNullableKeys<T>> &
  WithNonNullableKeys<T>;

export type Variable<T extends GraphQLVariableType, Name extends string> = {
  ' __zeus_name': Name;
  ' __zeus_type': T;
};

export type ExtractVariables<Query> = Query extends Variable<
  infer VType,
  infer VName
>
  ? { [key in VName]: GetVariableType<VType> }
  : Query extends [infer Inputs, infer Outputs]
    ? ExtractVariables<Inputs> & ExtractVariables<Outputs>
    : Query extends string | number | boolean
      ? // eslint-disable-next-line @typescript-eslint/ban-types
        {}
      : UnionToIntersection<
          {
            [K in keyof Query]: WithOptionalNullables<
              ExtractVariables<Query[K]>
            >;
          }[keyof Query]
        >;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

export const START_VAR_NAME = `$ZEUS_VAR`;
export const GRAPHQL_TYPE_SEPARATOR = `__$GRAPHQL__`;

export const $ = <Type extends GraphQLVariableType, Name extends string>(
  name: Name,
  graphqlType: Type,
) => {
  return (START_VAR_NAME +
    name +
    GRAPHQL_TYPE_SEPARATOR +
    graphqlType) as unknown as Variable<Type, Name>;
};
type ZEUS_INTERFACES = GraphQLTypes['Error'] | GraphQLTypes['Track'];
export type ScalarCoders = {};
type ZEUS_UNIONS =
  | GraphQLTypes['SimilarSpotifyTracksResult']
  | GraphQLTypes['SpotifySimilarLibraryTracks']
  | GraphQLTypes['SpotifyTrackAnalysisResult']
  | GraphQLTypes['AudioAnalysisV6']
  | GraphQLTypes['LibraryTrackResult']
  | GraphQLTypes['SimilarLibraryTracksResult']
  | GraphQLTypes['CrateCreateResult']
  | GraphQLTypes['CrateDeleteResult']
  | GraphQLTypes['CrateAddLibraryTracksResult']
  | GraphQLTypes['CrateRemoveLibraryTracksResult']
  | GraphQLTypes['LibraryTrackCreateResult']
  | GraphQLTypes['LibraryTrackEnqueueResult']
  | GraphQLTypes['LibraryTracksDeleteResult']
  | GraphQLTypes['YouTubeTrackEnqueueResult']
  | GraphQLTypes['SpotifyTrackResult']
  | GraphQLTypes['SpotifyTrackEnqueueResult']
  | GraphQLTypes['SimilarTracksResult']
  | GraphQLTypes['KeywordSearchResult']
  | GraphQLTypes['AugmentedKeywordsResult']
  | GraphQLTypes['SelectBrandValuesResult']
  | GraphQLTypes['BrandValuesResult']
  | GraphQLTypes['FreeTextSearchResult']
  | GraphQLTypes['LyricsSearchResult'];

export type ValueTypes = {
  ['Error']: AliasType<{
    message?: boolean | `@${string}`;
    ['...on NoSimilarSpotifyTracksAvailableError']?: Omit<
      ValueTypes['NoSimilarSpotifyTracksAvailableError'],
      keyof ValueTypes['Error']
    >;
    ['...on SpotifySimilarLibraryTracksError']?: Omit<
      ValueTypes['SpotifySimilarLibraryTracksError'],
      keyof ValueTypes['Error']
    >;
    ['...on SpotifyTrackNotFoundError']?: Omit<
      ValueTypes['SpotifyTrackNotFoundError'],
      keyof ValueTypes['Error']
    >;
    ['...on SpotifyTrackWithoutPreviewUrlError']?: Omit<
      ValueTypes['SpotifyTrackWithoutPreviewUrlError'],
      keyof ValueTypes['Error']
    >;
    ['...on AudioAnalysisV6Error']?: Omit<
      ValueTypes['AudioAnalysisV6Error'],
      keyof ValueTypes['Error']
    >;
    ['...on LibraryTrackNotFoundError']?: Omit<
      ValueTypes['LibraryTrackNotFoundError'],
      keyof ValueTypes['Error']
    >;
    ['...on SimilarLibraryTracksError']?: Omit<
      ValueTypes['SimilarLibraryTracksError'],
      keyof ValueTypes['Error']
    >;
    ['...on CrateCreateError']?: Omit<
      ValueTypes['CrateCreateError'],
      keyof ValueTypes['Error']
    >;
    ['...on CrateDeleteError']?: Omit<
      ValueTypes['CrateDeleteError'],
      keyof ValueTypes['Error']
    >;
    ['...on CrateAddLibraryTracksError']?: Omit<
      ValueTypes['CrateAddLibraryTracksError'],
      keyof ValueTypes['Error']
    >;
    ['...on CrateRemoveLibraryTracksError']?: Omit<
      ValueTypes['CrateRemoveLibraryTracksError'],
      keyof ValueTypes['Error']
    >;
    ['...on LibraryTrackCreateError']?: Omit<
      ValueTypes['LibraryTrackCreateError'],
      keyof ValueTypes['Error']
    >;
    ['...on LibraryTrackEnqueueError']?: Omit<
      ValueTypes['LibraryTrackEnqueueError'],
      keyof ValueTypes['Error']
    >;
    ['...on LibraryTracksDeleteError']?: Omit<
      ValueTypes['LibraryTracksDeleteError'],
      keyof ValueTypes['Error']
    >;
    ['...on SpotifyTrackError']?: Omit<
      ValueTypes['SpotifyTrackError'],
      keyof ValueTypes['Error']
    >;
    ['...on SpotifyTrackEnqueueError']?: Omit<
      ValueTypes['SpotifyTrackEnqueueError'],
      keyof ValueTypes['Error']
    >;
    ['...on SimilarTracksError']?: Omit<
      ValueTypes['SimilarTracksError'],
      keyof ValueTypes['Error']
    >;
    ['...on KeywordSearchError']?: Omit<
      ValueTypes['KeywordSearchError'],
      keyof ValueTypes['Error']
    >;
    ['...on AugmentedKeywordsError']?: Omit<
      ValueTypes['AugmentedKeywordsError'],
      keyof ValueTypes['Error']
    >;
    ['...on BrandValuesError']?: Omit<
      ValueTypes['BrandValuesError'],
      keyof ValueTypes['Error']
    >;
    ['...on FreeTextSearchError']?: Omit<
      ValueTypes['FreeTextSearchError'],
      keyof ValueTypes['Error']
    >;
    ['...on LyricsSearchError']?: Omit<
      ValueTypes['LyricsSearchError'],
      keyof ValueTypes['Error']
    >;
    __typename?: boolean | `@${string}`;
  }>;
  /** Relay Style PageInfo (https://facebook.github.io/relay/graphql/connections.htm) */
  ['PageInfo']: AliasType<{
    hasNextPage?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['SpotifyArtistInfo']: AliasType<{
    id?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['SpotifyTrackInfo']: AliasType<{
    id?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    artists?: ValueTypes['SpotifyArtistInfo'];
    __typename?: boolean | `@${string}`;
  }>;
  ['TrackAnalysisScores']: AliasType<{
    excited?: boolean | `@${string}`;
    euphoric?: boolean | `@${string}`;
    uplifting?: boolean | `@${string}`;
    angry?: boolean | `@${string}`;
    tense?: boolean | `@${string}`;
    melancholic?: boolean | `@${string}`;
    relaxed?: boolean | `@${string}`;
    happy?: boolean | `@${string}`;
    sad?: boolean | `@${string}`;
    dark?: boolean | `@${string}`;
    pumped?: boolean | `@${string}`;
    energetic?: boolean | `@${string}`;
    calm?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['TrackAnalysis']: AliasType<{
    arousal?: boolean | `@${string}`;
    valence?: boolean | `@${string}`;
    scores?: ValueTypes['TrackAnalysisScores'];
    __typename?: boolean | `@${string}`;
  }>;
  ['AnalysisStatus']: AnalysisStatus;
  ['FileInfo']: AliasType<{
    duration?: boolean | `@${string}`;
    fileSizeKb?: boolean | `@${string}`;
    bitrate?: boolean | `@${string}`;
    sampleRate?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['TrackSegmentAnalysis']: AliasType<{
    start?: boolean | `@${string}`;
    /** the timestamp this segment belongs to */
    timestamp?: boolean | `@${string}`;
    duration?: boolean | `@${string}`;
    analysis?: ValueTypes['TrackAnalysis'];
    __typename?: boolean | `@${string}`;
  }>;
  ['FileAnalysisLabel']: AliasType<{
    /** file analysis label title */
    title?: boolean | `@${string}`;
    /** identifier of the mood score this label represents */
    type?: boolean | `@${string}`;
    /** start of the interval */
    start?: boolean | `@${string}`;
    /** end of the interval */
    end?: boolean | `@${string}`;
    /** intensity of the mood score for the given interval */
    amount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['Mutation']: AliasType<{
    ping?: boolean | `@${string}`;
    /** Create a cyanite file upload request. */
    fileUploadRequest?: ValueTypes['FileUploadRequest'];
    crateCreate?: [
      { input: ValueTypes['CrateCreateInput'] | Variable<any, string> },
      ValueTypes['CrateCreateResult'],
    ];
    crateDelete?: [
      { input: ValueTypes['CrateDeleteInput'] | Variable<any, string> },
      ValueTypes['CrateDeleteResult'],
    ];
    crateAddLibraryTracks?: [
      {
        input: ValueTypes['CrateAddLibraryTracksInput'] | Variable<any, string>;
      },
      ValueTypes['CrateAddLibraryTracksResult'],
    ];
    crateRemoveLibraryTracks?: [
      {
        input:
          | ValueTypes['CrateRemoveLibraryTracksInput']
          | Variable<any, string>;
      },
      ValueTypes['CrateRemoveLibraryTracksResult'],
    ];
    libraryTrackCreate?: [
      { input: ValueTypes['LibraryTrackCreateInput'] | Variable<any, string> },
      ValueTypes['LibraryTrackCreateResult'],
    ];
    libraryTrackEnqueue?: [
      { input: ValueTypes['LibraryTrackEnqueueInput'] | Variable<any, string> },
      ValueTypes['LibraryTrackEnqueueResult'],
    ];
    libraryTracksDelete?: [
      { input: ValueTypes['LibraryTracksDeleteInput'] | Variable<any, string> },
      ValueTypes['LibraryTracksDeleteResult'],
    ];
    youTubeTrackEnqueue?: [
      { input: ValueTypes['YouTubeTrackEnqueueInput'] | Variable<any, string> },
      ValueTypes['YouTubeTrackEnqueueResult'],
    ];
    spotifyTrackEnqueue?: [
      { input: ValueTypes['SpotifyTrackEnqueueInput'] | Variable<any, string> },
      ValueTypes['SpotifyTrackEnqueueResult'],
    ];
    selectBrandValues?: [
      { input: ValueTypes['SelectBrandValuesInput'] | Variable<any, string> },
      ValueTypes['SelectBrandValuesResult'],
    ];
    __typename?: boolean | `@${string}`;
  }>;
  ['Query']: AliasType<{
    ping?: boolean | `@${string}`;
    spotifyTrackAnalysis?: [
      {
        /** The id of the spotify track */
        spotifyTrackId: string | Variable<any, string>;
      },
      ValueTypes['SpotifyTrackAnalysisResult'],
    ];
    libraryTrack?: [
      { id: string | Variable<any, string> },
      ValueTypes['LibraryTrackResult'],
    ];
    libraryTracks?: [
      {
        /** The amount of items that should be fetched. Default and maximum value is '50'. */
        first?:
          | number
          | undefined
          | null
          | Variable<
              any,
              string
            > /** A cursor string after which items should be fetched. */;
        after?:
          | string
          | undefined
          | null
          | Variable<any, string> /** Apply a filter on the library tracks. */;
        filter?:
          | ValueTypes['LibraryTracksFilter']
          | undefined
          | null
          | Variable<any, string>;
      },
      ValueTypes['LibraryTrackConnection'],
    ];
    crates?: [
      {
        /** The number of items that should be fetched. Default and maximum value is '10'. */
        first?:
          | number
          | undefined
          | null
          | Variable<
              any,
              string
            > /** A cursor string after which items should be fetched. */;
        after?: string | undefined | null | Variable<any, string>;
      },
      ValueTypes['CratesConnection'],
    ];
    spotifyTrack?: [
      { id: string | Variable<any, string> },
      ValueTypes['SpotifyTrackResult'],
    ];
    keywordSearch?: [
      {
        /** Amount of items to fetch. */
        first?:
          | number
          | undefined
          | null
          | Variable<
              any,
              string
            > /** What kind of results should be returned? Either Spotify or Library tracks. */;
        target:
          | ValueTypes['KeywordSearchTarget']
          | Variable<
              any,
              string
            > /** The keywords that will be used for searching tracks. */;
        keywords:
          | Array<ValueTypes['KeywordSearchKeyword']>
          | Variable<any, string>;
      },
      ValueTypes['KeywordSearchResult'],
    ];
    /** Search for keywords that can be used for the keyword search. */
    keywords?: ValueTypes['KeywordConnection'];
    /** Get a list of all available brand values */
    brandValues?: ValueTypes['BrandValuesResult'];
    freeTextSearch?: [
      {
        searchText: string | Variable<any, string>;
        target: ValueTypes['FreeTextSearchTarget'] | Variable<any, string>;
        first?: number | undefined | null | Variable<any, string>;
      },
      ValueTypes['FreeTextSearchResult'],
    ];
    lyricsSearch?: [
      {
        prompt: string | Variable<any, string>;
        target: ValueTypes['LyricsSearchTarget'] | Variable<any, string>;
        first?: number | undefined | null | Variable<any, string>;
      },
      ValueTypes['LyricsSearchResult'],
    ];
    __typename?: boolean | `@${string}`;
  }>;
  ['Subscription']: AliasType<{
    ping?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['InDepthAnalysisGenre']: AliasType<{
    title?: boolean | `@${string}`;
    confidence?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** This type is deprecated and will be removed in the future. */
  ['NoSimilarSpotifyTracksAvailableError']: AliasType<{
    message?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** This union type is deprecated and will be removed in the future. */
  ['SimilarSpotifyTracksResult']: AliasType<{
    ['...on NoSimilarSpotifyTracksAvailableError']: ValueTypes['NoSimilarSpotifyTracksAvailableError'];
    ['...on SimilarSpotifyTrackConnection']: ValueTypes['SimilarSpotifyTrackConnection'];
    __typename?: boolean | `@${string}`;
  }>;
  ['SimilarLibraryTrackNode']: AliasType<{
    distance?: boolean | `@${string}`;
    sort?: boolean | `@${string}`;
    inDepthAnalysisId?: boolean | `@${string}`;
    libraryTrack?: ValueTypes['LibraryTrack'];
    __typename?: boolean | `@${string}`;
  }>;
  ['SimilarLibraryTrackEdge']: AliasType<{
    cursor?: boolean | `@${string}`;
    node?: ValueTypes['SimilarLibraryTrackNode'];
    __typename?: boolean | `@${string}`;
  }>;
  ['SimilarLibraryTrackConnection']: AliasType<{
    pageInfo?: ValueTypes['PageInfo'];
    edges?: ValueTypes['SimilarLibraryTrackEdge'];
    __typename?: boolean | `@${string}`;
  }>;
  ['SimilaritySearchWeightFilter']: {
    genre?: number | undefined | null | Variable<any, string>;
    mood?: number | undefined | null | Variable<any, string>;
    voice?: number | undefined | null | Variable<any, string>;
    mfccs?: number | undefined | null | Variable<any, string>;
  };
  ['EnergyLevel']: EnergyLevel;
  ['EnergyDynamics']: EnergyDynamics;
  ['EmotionalProfile']: EmotionalProfile;
  ['EmotionalDynamics']: EmotionalDynamics;
  ['VoicePresenceProfile']: VoicePresenceProfile;
  ['PredominantVoiceGender']: PredominantVoiceGender;
  /** Describes the voice classifier results over time, mapped to the index of the timestamps. */
  ['VoiceSegmentScores']: AliasType<{
    /** Scores for female voice, mapped to the index of the timestamp. */
    female?: boolean | `@${string}`;
    /** Scores for instrumental, mapped to the index of the timestamp. */
    instrumental?: boolean | `@${string}`;
    /** Scores for male voice, mapped to the index of the timestamp. */
    male?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Describes the mean scores of the voice classifier result. */
  ['VoiceMeanScores']: AliasType<{
    /** Mean female score. */
    female?: boolean | `@${string}`;
    /** Mean instrumental score. */
    instrumental?: boolean | `@${string}`;
    /** Mean instrumental male score. */
    male?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['FileUploadRequest']: AliasType<{
    id?: boolean | `@${string}`;
    uploadUrl?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['InDepthAnalysisCreateInput']: {
    fileName: string | Variable<any, string>;
    uploadId: string | Variable<any, string>;
    organizationId?: string | undefined | null | Variable<any, string>;
    externalId?: string | undefined | null | Variable<any, string>;
    /** The associated file tag name. It can later on be used for filtering. */
    tags?: Array<string> | undefined | null | Variable<any, string>;
    /** Whether the file should be enqueued automatically */
    enqueue?: boolean | undefined | null | Variable<any, string>;
  };
  /** This type is deprecated and will be removed in the future. */
  ['SimilarSpotifyTrackNode']: AliasType<{
    distance?: boolean | `@${string}`;
    score?: boolean | `@${string}`;
    spotifyTrackId?: boolean | `@${string}`;
    trackInfo?: ValueTypes['SpotifyTrackInfo'];
    __typename?: boolean | `@${string}`;
  }>;
  /** This type is deprecated and will be removed in the future */
  ['SimilarSpotifyTrackEdge']: AliasType<{
    cursor?: boolean | `@${string}`;
    node?: ValueTypes['SimilarSpotifyTrackNode'];
    __typename?: boolean | `@${string}`;
  }>;
  /** This type is deprecated and will be removed in the future */
  ['SimilarSpotifyTrackConnection']: AliasType<{
    pageInfo?: ValueTypes['PageInfo'];
    edges?: ValueTypes['SimilarSpotifyTrackEdge'];
    __typename?: boolean | `@${string}`;
  }>;
  /** spotify analysis related stuff */
  ['SpotifyTrackAnalysis']: AliasType<{
    id?: boolean | `@${string}`;
    status?: boolean | `@${string}`;
    similarLibraryTracks?: [
      {
        weights?:
          | ValueTypes['SimilaritySearchWeightFilter']
          | undefined
          | null
          | Variable<any, string>;
      },
      ValueTypes['SpotifySimilarLibraryTracks'],
    ];
    __typename?: boolean | `@${string}`;
  }>;
  /** This type is deprecated and will be removed in the future. */
  ['SpotifySimilarLibraryTracks']: AliasType<{
    ['...on SpotifySimilarLibraryTracksResult']: ValueTypes['SpotifySimilarLibraryTracksResult'];
    ['...on SpotifySimilarLibraryTracksError']: ValueTypes['SpotifySimilarLibraryTracksError'];
    __typename?: boolean | `@${string}`;
  }>;
  /** This type is deprecated and will be removed in the future. */
  ['SpotifySimilarLibraryTracksResult']: AliasType<{
    results?: ValueTypes['LibraryTrack'];
    __typename?: boolean | `@${string}`;
  }>;
  /** This type is deprecated and will be removed in the future. */
  ['SpotifySimilarLibraryTracksError']: AliasType<{
    code?: boolean | `@${string}`;
    message?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['SpotifyTrackNotFoundError']: AliasType<{
    message?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['SpotifyTrackWithoutPreviewUrlError']: AliasType<{
    message?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['SpotifyTrackAnalysisResult']: AliasType<{
    ['...on SpotifyTrackAnalysis']: ValueTypes['SpotifyTrackAnalysis'];
    ['...on SpotifyTrackNotFoundError']: ValueTypes['SpotifyTrackNotFoundError'];
    ['...on SpotifyTrackWithoutPreviewUrlError']: ValueTypes['SpotifyTrackWithoutPreviewUrlError'];
    __typename?: boolean | `@${string}`;
  }>;
  ['Track']: AliasType<{
    id?: boolean | `@${string}`;
    title?: boolean | `@${string}`;
    audioAnalysisV6?: ValueTypes['AudioAnalysisV6'];
    similarTracks?: [
      {
        /** Amount of items to fetch. */
        first?:
          | number
          | undefined
          | null
          | Variable<
              any,
              string
            > /** The relevant parts of the track that should be used for the similarity search. */;
        searchMode?:
          | ValueTypes['SimilarTracksSearchMode']
          | undefined
          | null
          | Variable<
              any,
              string
            > /** What kind of results should be returned? Either Spotify or Library tracks. */;
        target:
          | ValueTypes['SimilarTracksTarget']
          | Variable<
              any,
              string
            > /** Filters to apply on to the similarity search. */;
        experimental_filter?:
          | ValueTypes['experimental_SimilarTracksFilter']
          | undefined
          | null
          | Variable<any, string>;
      },
      ValueTypes['SimilarTracksResult'],
    ];
    /** Augmented keywords that can be associated with the audio. */
    augmentedKeywords?: ValueTypes['AugmentedKeywordsResult'];
    /** Brand values that can be associated with the audio. */
    brandValues?: ValueTypes['BrandValuesResult'];
    ['...on LibraryTrack']?: Omit<
      ValueTypes['LibraryTrack'],
      keyof ValueTypes['Track']
    >;
    ['...on SpotifyTrack']?: Omit<
      ValueTypes['SpotifyTrack'],
      keyof ValueTypes['Track']
    >;
    __typename?: boolean | `@${string}`;
  }>;
  /** Possible results of querying Audio Analysis V6. */
  ['AudioAnalysisV6']: AliasType<{
    ['...on AudioAnalysisV6NotStarted']: ValueTypes['AudioAnalysisV6NotStarted'];
    ['...on AudioAnalysisV6Enqueued']: ValueTypes['AudioAnalysisV6Enqueued'];
    ['...on AudioAnalysisV6Processing']: ValueTypes['AudioAnalysisV6Processing'];
    ['...on AudioAnalysisV6Finished']: ValueTypes['AudioAnalysisV6Finished'];
    ['...on AudioAnalysisV6Failed']: ValueTypes['AudioAnalysisV6Failed'];
    __typename?: boolean | `@${string}`;
  }>;
  /** Audio Analysis V6 hasn't been started for this track yet. */
  ['AudioAnalysisV6NotStarted']: AliasType<{
    _?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Audio Analysis V6 is enqueued and will be processed soon. */
  ['AudioAnalysisV6Enqueued']: AliasType<{
    _?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Audio Analysis V6 is being processed. */
  ['AudioAnalysisV6Processing']: AliasType<{
    _?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Audio Analysis V6 is completed and the results can be retrieved. */
  ['AudioAnalysisV6Finished']: AliasType<{
    result?: ValueTypes['AudioAnalysisV6Result'];
    __typename?: boolean | `@${string}`;
  }>;
  /** Audio Analysis V6 failed. */
  ['AudioAnalysisV6Failed']: AliasType<{
    /** More detailed information on why the analysis has failed. */
    error?: ValueTypes['AudioAnalysisV6Error'];
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6Error']: AliasType<{
    message?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Describes all possible genre tags. */
  ['AudioAnalysisV6GenreTags']: AudioAnalysisV6GenreTags;
  /** Describes all possible EDM subgenre tags. */
  ['AudioAnalysisV6SubgenreEdmTags']: AudioAnalysisV6SubgenreEdmTags;
  /** Describes all possible mood tags. */
  ['AudioAnalysisV6MoodTags']: AudioAnalysisV6MoodTags;
  /** Describes a track segment where the particular mood is most prominent. */
  ['AudioAnalysisV6MaximumMoodInterval']: AliasType<{
    mood?: boolean | `@${string}`;
    /** Start of the segment in seconds. */
    start?: boolean | `@${string}`;
    /** End of the segment in seconds. */
    end?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6Genre']: AliasType<{
    /** Mean prediction value for the "ambient" genre. */
    ambient?: boolean | `@${string}`;
    /** Mean prediction value for the "blues" genre. */
    blues?: boolean | `@${string}`;
    /** Mean prediction value for the "classical" genre. */
    classical?: boolean | `@${string}`;
    /** Mean prediction value for the "country" genre. */
    country?: boolean | `@${string}`;
    /** Mean prediction value for the "electronicDance" genre. */
    electronicDance?: boolean | `@${string}`;
    /** Mean prediction value for the "folk" genre. */
    folk?: boolean | `@${string}`;
    /** Mean prediction value for the "folkCountry" genre. */
    folkCountry?: boolean | `@${string}`;
    /** Mean prediction value for the "indieAlternative" genre. */
    indieAlternative?: boolean | `@${string}`;
    /** Mean prediction value for the "funkSoul" genre. */
    funkSoul?: boolean | `@${string}`;
    /** Mean prediction value for the "jazz" genre. */
    jazz?: boolean | `@${string}`;
    /** Mean prediction value for the "latin" genre. */
    latin?: boolean | `@${string}`;
    /** Mean prediction value for the "metal" genre. */
    metal?: boolean | `@${string}`;
    /** Mean prediction value for the "pop" genre. */
    pop?: boolean | `@${string}`;
    /** Mean prediction value for the "punk" genre. */
    punk?: boolean | `@${string}`;
    /** Mean prediction value for the "rapHipHop" genre. */
    rapHipHop?: boolean | `@${string}`;
    /** Mean prediction value for the "reggae" genre. */
    reggae?: boolean | `@${string}`;
    /** Mean prediction value for the "rnb" genre. */
    rnb?: boolean | `@${string}`;
    /** Mean prediction value for the "rock" genre. */
    rock?: boolean | `@${string}`;
    /** Mean prediction value for the "singerSongwriter" genre. */
    singerSongwriter?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6GenreSegments']: AliasType<{
    /** Segments prediction value for the "ambient" genre. */
    ambient?: boolean | `@${string}`;
    /** Segments prediction value for the "blues" genre. */
    blues?: boolean | `@${string}`;
    /** Segments prediction value for the "classical" genre. */
    classical?: boolean | `@${string}`;
    /** Segments prediction value for the "country" genre. */
    country?: boolean | `@${string}`;
    /** Segments prediction value for the "electronicDance" genre. */
    electronicDance?: boolean | `@${string}`;
    /** Segments prediction value for the "folk" genre. */
    folk?: boolean | `@${string}`;
    /** Segments prediction value for the "folkCountry" genre. */
    folkCountry?: boolean | `@${string}`;
    /** Segments prediction value for the "indieAlternative" genre. */
    indieAlternative?: boolean | `@${string}`;
    /** Segments prediction value for the "funkSoul" genre. */
    funkSoul?: boolean | `@${string}`;
    /** Segments prediction value for the "jazz" genre. */
    jazz?: boolean | `@${string}`;
    /** Segments prediction value for the "latin" genre. */
    latin?: boolean | `@${string}`;
    /** Segments prediction value for the "metal" genre. */
    metal?: boolean | `@${string}`;
    /** Segments prediction value for the "pop" genre. */
    pop?: boolean | `@${string}`;
    /** Segments prediction value for the "punk" genre. */
    punk?: boolean | `@${string}`;
    /** Segments prediction value for the "rapHipHop" genre. */
    rapHipHop?: boolean | `@${string}`;
    /** Segments prediction value for the "reggae" genre. */
    reggae?: boolean | `@${string}`;
    /** Segments prediction value for the "rnb" genre. */
    rnb?: boolean | `@${string}`;
    /** Segments prediction value for the "rock" genre. */
    rock?: boolean | `@${string}`;
    /** Segments prediction value for the "singerSongwriter" genre. */
    singerSongwriter?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6SubgenreSegments']: AliasType<{
    /** Segments prediction value for the "bluesRock" sub-genre. */
    bluesRock?: boolean | `@${string}`;
    /** Segments prediction value for the "folkRock" sub-genre. */
    folkRock?: boolean | `@${string}`;
    /** Segments prediction value for the "hardRock" sub-genre. */
    hardRock?: boolean | `@${string}`;
    /** Segments prediction value for the "indieAlternative" sub-genre. */
    indieAlternative?: boolean | `@${string}`;
    /** Segments prediction value for the "psychedelicProgressiveRock" sub-genre. */
    psychedelicProgressiveRock?: boolean | `@${string}`;
    /** Segments prediction value for the "punk" sub-genre. */
    punk?: boolean | `@${string}`;
    /** Segments prediction value for the "rockAndRoll" sub-genre. */
    rockAndRoll?: boolean | `@${string}`;
    /** Segments prediction value for the "popSoftRock" sub-genre. */
    popSoftRock?: boolean | `@${string}`;
    /** Segments prediction value for the "abstractIDMLeftfield" sub-genre. */
    abstractIDMLeftfield?: boolean | `@${string}`;
    /** Segments prediction value for the "breakbeatDnB" sub-genre. */
    breakbeatDnB?: boolean | `@${string}`;
    /** Segments prediction value for the "deepHouse" sub-genre. */
    deepHouse?: boolean | `@${string}`;
    /** Segments prediction value for the "electro" sub-genre. */
    electro?: boolean | `@${string}`;
    /** Segments prediction value for the "house" sub-genre. */
    house?: boolean | `@${string}`;
    /** Segments prediction value for the "minimal" sub-genre. */
    minimal?: boolean | `@${string}`;
    /** Segments prediction value for the "synthPop" sub-genre. */
    synthPop?: boolean | `@${string}`;
    /** Segments prediction value for the "techHouse" sub-genre. */
    techHouse?: boolean | `@${string}`;
    /** Segments prediction value for the "techno" sub-genre. */
    techno?: boolean | `@${string}`;
    /** Segments prediction value for the "trance" sub-genre. */
    trance?: boolean | `@${string}`;
    /** Segments prediction value for the "contemporaryRnB" sub-genre. */
    contemporaryRnB?: boolean | `@${string}`;
    /** Segments prediction value for the "gangsta" sub-genre. */
    gangsta?: boolean | `@${string}`;
    /** Segments prediction value for the "jazzyHipHop" sub-genre. */
    jazzyHipHop?: boolean | `@${string}`;
    /** Segments prediction value for the "popRap" sub-genre. */
    popRap?: boolean | `@${string}`;
    /** Segments prediction value for the "trap" sub-genre. */
    trap?: boolean | `@${string}`;
    /** Segments prediction value for the "blackMetal" sub-genre. */
    blackMetal?: boolean | `@${string}`;
    /** Segments prediction value for the "deathMetal" sub-genre. */
    deathMetal?: boolean | `@${string}`;
    /** Segments prediction value for the "doomMetal" sub-genre. */
    doomMetal?: boolean | `@${string}`;
    /** Segments prediction value for the "heavyMetal" sub-genre. */
    heavyMetal?: boolean | `@${string}`;
    /** Segments prediction value for the "metalcore" sub-genre. */
    metalcore?: boolean | `@${string}`;
    /** Segments prediction value for the "nuMetal" sub-genre. */
    nuMetal?: boolean | `@${string}`;
    /** Segments prediction value for the "disco" sub-genre. */
    disco?: boolean | `@${string}`;
    /** Segments prediction value for the "funk" sub-genre. */
    funk?: boolean | `@${string}`;
    /** Segments prediction value for the "gospel" sub-genre. */
    gospel?: boolean | `@${string}`;
    /** Segments prediction value for the "neoSoul" sub-genre. */
    neoSoul?: boolean | `@${string}`;
    /** Segments prediction value for the "soul" sub-genre. */
    soul?: boolean | `@${string}`;
    /** Segments prediction value for the "bigBandSwing" sub-genre. */
    bigBandSwing?: boolean | `@${string}`;
    /** Segments prediction value for the "bebop" sub-genre. */
    bebop?: boolean | `@${string}`;
    /** Segments prediction value for the "contemporaryJazz" sub-genre. */
    contemporaryJazz?: boolean | `@${string}`;
    /** Segments prediction value for the "easyListening" sub-genre. */
    easyListening?: boolean | `@${string}`;
    /** Segments prediction value for the "fusion" sub-genre. */
    fusion?: boolean | `@${string}`;
    /** Segments prediction value for the "latinJazz" sub-genre. */
    latinJazz?: boolean | `@${string}`;
    /** Segments prediction value for the "smoothJazz" sub-genre. */
    smoothJazz?: boolean | `@${string}`;
    /** Segments prediction value for the "country" sub-genre. */
    country?: boolean | `@${string}`;
    /** Segments prediction value for the "folk" sub-genre. */
    folk?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** This type is fully deprecated all the subgenre EDM values moved to the AudioAnalysisV6Subgenre type. */
  ['AudioAnalysisV6SubgenreEdm']: AliasType<{
    /** Mean prediction value for the "breakbeatDrumAndBass" EDM subgenre. */
    breakbeatDrumAndBass?: boolean | `@${string}`;
    /** Mean prediction value for the "deepHouse" EDM subgenre. */
    deepHouse?: boolean | `@${string}`;
    /** Mean prediction value for the "electro" EDM subgenre. */
    electro?: boolean | `@${string}`;
    /** Mean prediction value for the "house" EDM subgenre. */
    house?: boolean | `@${string}`;
    /** Mean prediction value for the "minimal" EDM subgenre. */
    minimal?: boolean | `@${string}`;
    /** Mean prediction value for the "techHouse" EDM subgenre. */
    techHouse?: boolean | `@${string}`;
    /** Mean prediction value for the "techno" EDM subgenre. */
    techno?: boolean | `@${string}`;
    /** Mean prediction value for the "trance" EDM subgenre. */
    trance?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6SubgenreTags']: AudioAnalysisV6SubgenreTags;
  ['AudioAnalysisV6Subgenre']: AliasType<{
    /** Mean prediction value for the "bluesRock" sub-genre. */
    bluesRock?: boolean | `@${string}`;
    /** Mean prediction value for the "folkRock" sub-genre. */
    folkRock?: boolean | `@${string}`;
    /** Mean prediction value for the "hardRock" sub-genre. */
    hardRock?: boolean | `@${string}`;
    /** Mean prediction value for the "indieAlternative" sub-genre. */
    indieAlternative?: boolean | `@${string}`;
    /** Mean prediction value for the "psychedelicProgressiveRock" sub-genre. */
    psychedelicProgressiveRock?: boolean | `@${string}`;
    /** Mean prediction value for the "punk" sub-genre. */
    punk?: boolean | `@${string}`;
    /** Mean prediction value for the "rockAndRoll" sub-genre. */
    rockAndRoll?: boolean | `@${string}`;
    /** Mean prediction value for the "popSoftRock" sub-genre. */
    popSoftRock?: boolean | `@${string}`;
    /** Mean prediction value for the "abstractIDMLeftfield" sub-genre. */
    abstractIDMLeftfield?: boolean | `@${string}`;
    /** Mean prediction value for the "breakbeatDnB" sub-genre. */
    breakbeatDnB?: boolean | `@${string}`;
    /** Mean prediction value for the "deepHouse" sub-genre. */
    deepHouse?: boolean | `@${string}`;
    /** Mean prediction value for the "electro" sub-genre. */
    electro?: boolean | `@${string}`;
    /** Mean prediction value for the "house" sub-genre. */
    house?: boolean | `@${string}`;
    /** Mean prediction value for the "minimal" sub-genre. */
    minimal?: boolean | `@${string}`;
    /** Mean prediction value for the "synthPop" sub-genre. */
    synthPop?: boolean | `@${string}`;
    /** Mean prediction value for the "techHouse" sub-genre. */
    techHouse?: boolean | `@${string}`;
    /** Mean prediction value for the "techno" sub-genre. */
    techno?: boolean | `@${string}`;
    /** Mean prediction value for the "trance" sub-genre. */
    trance?: boolean | `@${string}`;
    /** Mean prediction value for the "contemporaryRnB" sub-genre. */
    contemporaryRnB?: boolean | `@${string}`;
    /** Mean prediction value for the "gangsta" sub-genre. */
    gangsta?: boolean | `@${string}`;
    /** Mean prediction value for the "jazzyHipHop" sub-genre. */
    jazzyHipHop?: boolean | `@${string}`;
    /** Mean prediction value for the "popRap" sub-genre. */
    popRap?: boolean | `@${string}`;
    /** Mean prediction value for the "trap" sub-genre. */
    trap?: boolean | `@${string}`;
    /** Mean prediction value for the "blackMetal" sub-genre. */
    blackMetal?: boolean | `@${string}`;
    /** Mean prediction value for the "deathMetal" sub-genre. */
    deathMetal?: boolean | `@${string}`;
    /** Mean prediction value for the "doomMetal" sub-genre. */
    doomMetal?: boolean | `@${string}`;
    /** Mean prediction value for the "heavyMetal" sub-genre. */
    heavyMetal?: boolean | `@${string}`;
    /** Mean prediction value for the "metalcore" sub-genre. */
    metalcore?: boolean | `@${string}`;
    /** Mean prediction value for the "nuMetal" sub-genre. */
    nuMetal?: boolean | `@${string}`;
    /** Mean prediction value for the "disco" sub-genre. */
    disco?: boolean | `@${string}`;
    /** Mean prediction value for the "funk" sub-genre. */
    funk?: boolean | `@${string}`;
    /** Mean prediction value for the "gospel" sub-genre. */
    gospel?: boolean | `@${string}`;
    /** Mean prediction value for the "neoSoul" sub-genre. */
    neoSoul?: boolean | `@${string}`;
    /** Mean prediction value for the "soul" sub-genre. */
    soul?: boolean | `@${string}`;
    /** Mean prediction value for the "bigBandSwing" sub-genre. */
    bigBandSwing?: boolean | `@${string}`;
    /** Mean prediction value for the "bebop" sub-genre. */
    bebop?: boolean | `@${string}`;
    /** Mean prediction value for the "contemporaryJazz" sub-genre. */
    contemporaryJazz?: boolean | `@${string}`;
    /** Mean prediction value for the "easyListening" sub-genre. */
    easyListening?: boolean | `@${string}`;
    /** Mean prediction value for the "fusion" sub-genre. */
    fusion?: boolean | `@${string}`;
    /** Mean prediction value for the "latinJazz" sub-genre. */
    latinJazz?: boolean | `@${string}`;
    /** Mean prediction value for the "smoothJazz" sub-genre. */
    smoothJazz?: boolean | `@${string}`;
    /** Mean prediction value for the "country" sub-genre. */
    country?: boolean | `@${string}`;
    /** Mean prediction value for the "folk" sub-genre. */
    folk?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6Mood']: AliasType<{
    /** Mean prediction value for the "aggressive" mood. */
    aggressive?: boolean | `@${string}`;
    /** Mean prediction value for the "calm" mood. */
    calm?: boolean | `@${string}`;
    /** Mean prediction value for the "chilled" mood. */
    chilled?: boolean | `@${string}`;
    /** Mean prediction value for the "dark" mood. */
    dark?: boolean | `@${string}`;
    /** Mean prediction value for the "energetic" mood. */
    energetic?: boolean | `@${string}`;
    /** Mean prediction value for the "epic" mood. */
    epic?: boolean | `@${string}`;
    /** Mean prediction value for the "happy" mood. */
    happy?: boolean | `@${string}`;
    /** Mean prediction value for the "romantic" mood. */
    romantic?: boolean | `@${string}`;
    /** Mean prediction value for the "sad" mood. */
    sad?: boolean | `@${string}`;
    /** Mean prediction value for the "scary" mood. */
    scary?: boolean | `@${string}`;
    /** Mean prediction value for the "sexy" mood. */
    sexy?: boolean | `@${string}`;
    /** Mean prediction value for the "ethereal" mood. */
    ethereal?: boolean | `@${string}`;
    /** Mean prediction value for the "uplifting" mood. */
    uplifting?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6MoodSegments']: AliasType<{
    /** Segments prediction value for the "aggressive" mood. */
    aggressive?: boolean | `@${string}`;
    /** Segments prediction value for the "calm" mood. */
    calm?: boolean | `@${string}`;
    /** Segments prediction value for the "chilled" mood. */
    chilled?: boolean | `@${string}`;
    /** Segments prediction value for the "dark" mood. */
    dark?: boolean | `@${string}`;
    /** Segments prediction value for the "energetic" mood. */
    energetic?: boolean | `@${string}`;
    /** Segments prediction value for the "epic" mood. */
    epic?: boolean | `@${string}`;
    /** Segments prediction value for the "happy" mood. */
    happy?: boolean | `@${string}`;
    /** Segments prediction value for the "romantic" mood. */
    romantic?: boolean | `@${string}`;
    /** Segments prediction value for the "sad" mood. */
    sad?: boolean | `@${string}`;
    /** Segments prediction value for the "scary" mood. */
    scary?: boolean | `@${string}`;
    /** Segments prediction value for the "sexy" mood. */
    sexy?: boolean | `@${string}`;
    /** Segments prediction value for the "ethereal" mood. */
    ethereal?: boolean | `@${string}`;
    /** Segments prediction value for the "uplifting" mood. */
    uplifting?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6Instruments']: AliasType<{
    /** Mean prediction value for the "percussion" instrument presence. */
    percussion?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Instruments detected by the instrument recognition. */
  ['AudioAnalysisV6InstrumentTags']: AudioAnalysisV6InstrumentTags;
  /** The intensity of an instrument's presence throughout a track. */
  ['AudioAnalysisInstrumentPresenceLabel']: AudioAnalysisInstrumentPresenceLabel;
  /** The intensity of an instrument's presence throughout a track. */
  ['AudioAnalysisV6InstrumentPresence']: AliasType<{
    /** Intensity of the percussion instrument. */
    percussion?: boolean | `@${string}`;
    /** Intensity of the synthesizer instrument. */
    synth?: boolean | `@${string}`;
    /** Intensity of the piano instrument. */
    piano?: boolean | `@${string}`;
    /** Intensity of the acoustic guitar instrument. */
    acousticGuitar?: boolean | `@${string}`;
    /** Intensity of the electric guitar instrument. */
    electricGuitar?: boolean | `@${string}`;
    /** Intensity of the strings instrument. */
    strings?: boolean | `@${string}`;
    /** Intensity of the bass instrument. */
    bass?: boolean | `@${string}`;
    /** Intensity of the bass guitar instrument. */
    bassGuitar?: boolean | `@${string}`;
    /** Intensity of the brass/woodwinds instrument. */
    brassWoodwinds?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6InstrumentsSegments']: AliasType<{
    /** Segments prediction value for the "percussion" instrument presence. */
    percussion?: boolean | `@${string}`;
    /** Segments prediction value for the "synth" instrument presence. */
    synth?: boolean | `@${string}`;
    /** Segments prediction value for the "piano" instrument presence. */
    piano?: boolean | `@${string}`;
    /** Segments prediction value for the "acousticGuitar" instrument presence. */
    acousticGuitar?: boolean | `@${string}`;
    /** Segments prediction value for the "electricGuitar" instrument presence. */
    electricGuitar?: boolean | `@${string}`;
    /** Segments prediction value for the "strings" instrument presence. */
    strings?: boolean | `@${string}`;
    /** Segments prediction value for the "bass" instrument presence. */
    bass?: boolean | `@${string}`;
    /** Segments prediction value for the "bassGuitar" instrument presence. */
    bassGuitar?: boolean | `@${string}`;
    /** Segments prediction value for the "brassWoodwinds" instrument presence. */
    brassWoodwinds?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6Voice']: AliasType<{
    /** Mean prediction value for the "female" voice type. */
    female?: boolean | `@${string}`;
    /** Mean prediction value for the "instrumental" voice type. */
    instrumental?: boolean | `@${string}`;
    /** Mean prediction value for the "male" voice type. */
    male?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6VoiceSegments']: AliasType<{
    /** Segments prediction value for the "female" voice type. */
    female?: boolean | `@${string}`;
    /** Segments prediction value for the "instrumental" voice type. */
    instrumental?: boolean | `@${string}`;
    /** Segments prediction value for the "male" voice type. */
    male?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6SubgenreEdmSegments']: AliasType<{
    /** Segments prediction value for the "breakbeatDrumAndBass" EDM subgenre. */
    breakbeatDrumAndBass?: boolean | `@${string}`;
    /** Segments prediction value for the "deepHouse" EDM subgenre. */
    deepHouse?: boolean | `@${string}`;
    /** Segments prediction value for the "electro" EDM subgenre. */
    electro?: boolean | `@${string}`;
    /** Segments prediction value for the "house" EDM subgenre. */
    house?: boolean | `@${string}`;
    /** Segments prediction value for the "minimal" EDM subgenre. */
    minimal?: boolean | `@${string}`;
    /** Segments prediction value for the "techHouse" EDM subgenre. */
    techHouse?: boolean | `@${string}`;
    /** Segments prediction value for the "techno" EDM subgenre. */
    techno?: boolean | `@${string}`;
    /** Segments prediction value for the "trance" EDM subgenre. */
    trance?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6Movement']: AliasType<{
    bouncy?: boolean | `@${string}`;
    driving?: boolean | `@${string}`;
    flowing?: boolean | `@${string}`;
    groovy?: boolean | `@${string}`;
    nonrhythmic?: boolean | `@${string}`;
    pulsing?: boolean | `@${string}`;
    robotic?: boolean | `@${string}`;
    running?: boolean | `@${string}`;
    steady?: boolean | `@${string}`;
    stomping?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6MovementSegments']: AliasType<{
    bouncy?: boolean | `@${string}`;
    driving?: boolean | `@${string}`;
    flowing?: boolean | `@${string}`;
    groovy?: boolean | `@${string}`;
    nonrhythmic?: boolean | `@${string}`;
    pulsing?: boolean | `@${string}`;
    robotic?: boolean | `@${string}`;
    running?: boolean | `@${string}`;
    steady?: boolean | `@${string}`;
    stomping?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6Character']: AliasType<{
    bold?: boolean | `@${string}`;
    cool?: boolean | `@${string}`;
    epic?: boolean | `@${string}`;
    ethereal?: boolean | `@${string}`;
    heroic?: boolean | `@${string}`;
    luxurious?: boolean | `@${string}`;
    magical?: boolean | `@${string}`;
    mysterious?: boolean | `@${string}`;
    playful?: boolean | `@${string}`;
    powerful?: boolean | `@${string}`;
    retro?: boolean | `@${string}`;
    sophisticated?: boolean | `@${string}`;
    sparkling?: boolean | `@${string}`;
    sparse?: boolean | `@${string}`;
    unpolished?: boolean | `@${string}`;
    warm?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6CharacterSegments']: AliasType<{
    bold?: boolean | `@${string}`;
    cool?: boolean | `@${string}`;
    epic?: boolean | `@${string}`;
    ethereal?: boolean | `@${string}`;
    heroic?: boolean | `@${string}`;
    luxurious?: boolean | `@${string}`;
    magical?: boolean | `@${string}`;
    mysterious?: boolean | `@${string}`;
    playful?: boolean | `@${string}`;
    powerful?: boolean | `@${string}`;
    retro?: boolean | `@${string}`;
    sophisticated?: boolean | `@${string}`;
    sparkling?: boolean | `@${string}`;
    sparse?: boolean | `@${string}`;
    unpolished?: boolean | `@${string}`;
    warm?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6ClassicalEpoch']: AliasType<{
    middleAge?: boolean | `@${string}`;
    renaissance?: boolean | `@${string}`;
    baroque?: boolean | `@${string}`;
    classical?: boolean | `@${string}`;
    romantic?: boolean | `@${string}`;
    contemporary?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6ClassicalEpochSegments']: AliasType<{
    middleAge?: boolean | `@${string}`;
    renaissance?: boolean | `@${string}`;
    baroque?: boolean | `@${string}`;
    classical?: boolean | `@${string}`;
    romantic?: boolean | `@${string}`;
    contemporary?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6MoodAdvanced']: AliasType<{
    anxious?: boolean | `@${string}`;
    barren?: boolean | `@${string}`;
    cold?: boolean | `@${string}`;
    creepy?: boolean | `@${string}`;
    dark?: boolean | `@${string}`;
    disturbing?: boolean | `@${string}`;
    eerie?: boolean | `@${string}`;
    evil?: boolean | `@${string}`;
    fearful?: boolean | `@${string}`;
    mysterious?: boolean | `@${string}`;
    nervous?: boolean | `@${string}`;
    restless?: boolean | `@${string}`;
    spooky?: boolean | `@${string}`;
    strange?: boolean | `@${string}`;
    supernatural?: boolean | `@${string}`;
    suspenseful?: boolean | `@${string}`;
    tense?: boolean | `@${string}`;
    weird?: boolean | `@${string}`;
    aggressive?: boolean | `@${string}`;
    agitated?: boolean | `@${string}`;
    angry?: boolean | `@${string}`;
    dangerous?: boolean | `@${string}`;
    fiery?: boolean | `@${string}`;
    intense?: boolean | `@${string}`;
    passionate?: boolean | `@${string}`;
    ponderous?: boolean | `@${string}`;
    violent?: boolean | `@${string}`;
    comedic?: boolean | `@${string}`;
    eccentric?: boolean | `@${string}`;
    funny?: boolean | `@${string}`;
    mischievous?: boolean | `@${string}`;
    quirky?: boolean | `@${string}`;
    whimsical?: boolean | `@${string}`;
    boisterous?: boolean | `@${string}`;
    boingy?: boolean | `@${string}`;
    bright?: boolean | `@${string}`;
    celebratory?: boolean | `@${string}`;
    cheerful?: boolean | `@${string}`;
    excited?: boolean | `@${string}`;
    feelGood?: boolean | `@${string}`;
    fun?: boolean | `@${string}`;
    happy?: boolean | `@${string}`;
    joyous?: boolean | `@${string}`;
    lighthearted?: boolean | `@${string}`;
    perky?: boolean | `@${string}`;
    playful?: boolean | `@${string}`;
    rollicking?: boolean | `@${string}`;
    upbeat?: boolean | `@${string}`;
    calm?: boolean | `@${string}`;
    contented?: boolean | `@${string}`;
    dreamy?: boolean | `@${string}`;
    introspective?: boolean | `@${string}`;
    laidBack?: boolean | `@${string}`;
    leisurely?: boolean | `@${string}`;
    lyrical?: boolean | `@${string}`;
    peaceful?: boolean | `@${string}`;
    quiet?: boolean | `@${string}`;
    relaxed?: boolean | `@${string}`;
    serene?: boolean | `@${string}`;
    soothing?: boolean | `@${string}`;
    spiritual?: boolean | `@${string}`;
    tranquil?: boolean | `@${string}`;
    bittersweet?: boolean | `@${string}`;
    blue?: boolean | `@${string}`;
    depressing?: boolean | `@${string}`;
    gloomy?: boolean | `@${string}`;
    heavy?: boolean | `@${string}`;
    lonely?: boolean | `@${string}`;
    melancholic?: boolean | `@${string}`;
    mournful?: boolean | `@${string}`;
    poignant?: boolean | `@${string}`;
    sad?: boolean | `@${string}`;
    frightening?: boolean | `@${string}`;
    horror?: boolean | `@${string}`;
    menacing?: boolean | `@${string}`;
    nightmarish?: boolean | `@${string}`;
    ominous?: boolean | `@${string}`;
    panicStricken?: boolean | `@${string}`;
    scary?: boolean | `@${string}`;
    concerned?: boolean | `@${string}`;
    determined?: boolean | `@${string}`;
    dignified?: boolean | `@${string}`;
    emotional?: boolean | `@${string}`;
    noble?: boolean | `@${string}`;
    serious?: boolean | `@${string}`;
    solemn?: boolean | `@${string}`;
    thoughtful?: boolean | `@${string}`;
    cool?: boolean | `@${string}`;
    seductive?: boolean | `@${string}`;
    sexy?: boolean | `@${string}`;
    adventurous?: boolean | `@${string}`;
    confident?: boolean | `@${string}`;
    courageous?: boolean | `@${string}`;
    resolute?: boolean | `@${string}`;
    energetic?: boolean | `@${string}`;
    epic?: boolean | `@${string}`;
    exciting?: boolean | `@${string}`;
    exhilarating?: boolean | `@${string}`;
    heroic?: boolean | `@${string}`;
    majestic?: boolean | `@${string}`;
    powerful?: boolean | `@${string}`;
    prestigious?: boolean | `@${string}`;
    relentless?: boolean | `@${string}`;
    strong?: boolean | `@${string}`;
    triumphant?: boolean | `@${string}`;
    victorious?: boolean | `@${string}`;
    delicate?: boolean | `@${string}`;
    graceful?: boolean | `@${string}`;
    hopeful?: boolean | `@${string}`;
    innocent?: boolean | `@${string}`;
    intimate?: boolean | `@${string}`;
    kind?: boolean | `@${string}`;
    light?: boolean | `@${string}`;
    loving?: boolean | `@${string}`;
    nostalgic?: boolean | `@${string}`;
    reflective?: boolean | `@${string}`;
    romantic?: boolean | `@${string}`;
    sentimental?: boolean | `@${string}`;
    soft?: boolean | `@${string}`;
    sweet?: boolean | `@${string}`;
    tender?: boolean | `@${string}`;
    warm?: boolean | `@${string}`;
    anthemic?: boolean | `@${string}`;
    aweInspiring?: boolean | `@${string}`;
    euphoric?: boolean | `@${string}`;
    inspirational?: boolean | `@${string}`;
    motivational?: boolean | `@${string}`;
    optimistic?: boolean | `@${string}`;
    positive?: boolean | `@${string}`;
    proud?: boolean | `@${string}`;
    soaring?: boolean | `@${string}`;
    uplifting?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6MoodAdvancedSegments']: AliasType<{
    anxious?: boolean | `@${string}`;
    barren?: boolean | `@${string}`;
    cold?: boolean | `@${string}`;
    creepy?: boolean | `@${string}`;
    dark?: boolean | `@${string}`;
    disturbing?: boolean | `@${string}`;
    eerie?: boolean | `@${string}`;
    evil?: boolean | `@${string}`;
    fearful?: boolean | `@${string}`;
    mysterious?: boolean | `@${string}`;
    nervous?: boolean | `@${string}`;
    restless?: boolean | `@${string}`;
    spooky?: boolean | `@${string}`;
    strange?: boolean | `@${string}`;
    supernatural?: boolean | `@${string}`;
    suspenseful?: boolean | `@${string}`;
    tense?: boolean | `@${string}`;
    weird?: boolean | `@${string}`;
    aggressive?: boolean | `@${string}`;
    agitated?: boolean | `@${string}`;
    angry?: boolean | `@${string}`;
    dangerous?: boolean | `@${string}`;
    fiery?: boolean | `@${string}`;
    intense?: boolean | `@${string}`;
    passionate?: boolean | `@${string}`;
    ponderous?: boolean | `@${string}`;
    violent?: boolean | `@${string}`;
    comedic?: boolean | `@${string}`;
    eccentric?: boolean | `@${string}`;
    funny?: boolean | `@${string}`;
    mischievous?: boolean | `@${string}`;
    quirky?: boolean | `@${string}`;
    whimsical?: boolean | `@${string}`;
    boisterous?: boolean | `@${string}`;
    boingy?: boolean | `@${string}`;
    bright?: boolean | `@${string}`;
    celebratory?: boolean | `@${string}`;
    cheerful?: boolean | `@${string}`;
    excited?: boolean | `@${string}`;
    feelGood?: boolean | `@${string}`;
    fun?: boolean | `@${string}`;
    happy?: boolean | `@${string}`;
    joyous?: boolean | `@${string}`;
    lighthearted?: boolean | `@${string}`;
    perky?: boolean | `@${string}`;
    playful?: boolean | `@${string}`;
    rollicking?: boolean | `@${string}`;
    upbeat?: boolean | `@${string}`;
    calm?: boolean | `@${string}`;
    contented?: boolean | `@${string}`;
    dreamy?: boolean | `@${string}`;
    introspective?: boolean | `@${string}`;
    laidBack?: boolean | `@${string}`;
    leisurely?: boolean | `@${string}`;
    lyrical?: boolean | `@${string}`;
    peaceful?: boolean | `@${string}`;
    quiet?: boolean | `@${string}`;
    relaxed?: boolean | `@${string}`;
    serene?: boolean | `@${string}`;
    soothing?: boolean | `@${string}`;
    spiritual?: boolean | `@${string}`;
    tranquil?: boolean | `@${string}`;
    bittersweet?: boolean | `@${string}`;
    blue?: boolean | `@${string}`;
    depressing?: boolean | `@${string}`;
    gloomy?: boolean | `@${string}`;
    heavy?: boolean | `@${string}`;
    lonely?: boolean | `@${string}`;
    melancholic?: boolean | `@${string}`;
    mournful?: boolean | `@${string}`;
    poignant?: boolean | `@${string}`;
    sad?: boolean | `@${string}`;
    frightening?: boolean | `@${string}`;
    horror?: boolean | `@${string}`;
    menacing?: boolean | `@${string}`;
    nightmarish?: boolean | `@${string}`;
    ominous?: boolean | `@${string}`;
    panicStricken?: boolean | `@${string}`;
    scary?: boolean | `@${string}`;
    concerned?: boolean | `@${string}`;
    determined?: boolean | `@${string}`;
    dignified?: boolean | `@${string}`;
    emotional?: boolean | `@${string}`;
    noble?: boolean | `@${string}`;
    serious?: boolean | `@${string}`;
    solemn?: boolean | `@${string}`;
    thoughtful?: boolean | `@${string}`;
    cool?: boolean | `@${string}`;
    seductive?: boolean | `@${string}`;
    sexy?: boolean | `@${string}`;
    adventurous?: boolean | `@${string}`;
    confident?: boolean | `@${string}`;
    courageous?: boolean | `@${string}`;
    resolute?: boolean | `@${string}`;
    energetic?: boolean | `@${string}`;
    epic?: boolean | `@${string}`;
    exciting?: boolean | `@${string}`;
    exhilarating?: boolean | `@${string}`;
    heroic?: boolean | `@${string}`;
    majestic?: boolean | `@${string}`;
    powerful?: boolean | `@${string}`;
    prestigious?: boolean | `@${string}`;
    relentless?: boolean | `@${string}`;
    strong?: boolean | `@${string}`;
    triumphant?: boolean | `@${string}`;
    victorious?: boolean | `@${string}`;
    delicate?: boolean | `@${string}`;
    graceful?: boolean | `@${string}`;
    hopeful?: boolean | `@${string}`;
    innocent?: boolean | `@${string}`;
    intimate?: boolean | `@${string}`;
    kind?: boolean | `@${string}`;
    light?: boolean | `@${string}`;
    loving?: boolean | `@${string}`;
    nostalgic?: boolean | `@${string}`;
    reflective?: boolean | `@${string}`;
    romantic?: boolean | `@${string}`;
    sentimental?: boolean | `@${string}`;
    soft?: boolean | `@${string}`;
    sweet?: boolean | `@${string}`;
    tender?: boolean | `@${string}`;
    warm?: boolean | `@${string}`;
    anthemic?: boolean | `@${string}`;
    aweInspiring?: boolean | `@${string}`;
    euphoric?: boolean | `@${string}`;
    inspirational?: boolean | `@${string}`;
    motivational?: boolean | `@${string}`;
    optimistic?: boolean | `@${string}`;
    positive?: boolean | `@${string}`;
    proud?: boolean | `@${string}`;
    soaring?: boolean | `@${string}`;
    uplifting?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Describes possible energy levels values. */
  ['AudioAnalysisV6EnergyLevel']: AudioAnalysisV6EnergyLevel;
  /** Describes possible energy dynamics values. */
  ['AudioAnalysisV6EnergyDynamics']: AudioAnalysisV6EnergyDynamics;
  /** Describes possible emotional profile values. */
  ['AudioAnalysisV6EmotionalProfile']: AudioAnalysisV6EmotionalProfile;
  /** Describes possible emotional dynamics values. */
  ['AudioAnalysisV6EmotionalDynamics']: AudioAnalysisV6EmotionalDynamics;
  /** Describes possible voice presence profile values. */
  ['AudioAnalysisV6VoicePresenceProfile']: AudioAnalysisV6VoicePresenceProfile;
  /** Describes possible predominant voice gender values. */
  ['AudioAnalysisV6PredominantVoiceGender']: AudioAnalysisV6PredominantVoiceGender;
  ['AudioAnalysisV6VoiceTags']: AudioAnalysisV6VoiceTags;
  ['AudioAnalysisV6MovementTags']: AudioAnalysisV6MovementTags;
  ['AudioAnalysisV6CharacterTags']: AudioAnalysisV6CharacterTags;
  ['AudioAnalysisV6ClassicalEpochTags']: AudioAnalysisV6ClassicalEpochTags;
  ['AudioAnalysisV6MoodAdvancedTags']: AudioAnalysisV6MoodAdvancedTags;
  ['AudioAnalysisV6Segments']: AliasType<{
    /** Index of the most representative segment for the track. */
    representativeSegmentIndex?: boolean | `@${string}`;
    /** The timestamps of each analysis segment. */
    timestamps?: boolean | `@${string}`;
    /** The mood prediction of each analysis segment. */
    mood?: ValueTypes['AudioAnalysisV6MoodSegments'];
    /** The voice prediction of each analysis segment. */
    voice?: ValueTypes['AudioAnalysisV6VoiceSegments'];
    /** The instrument prediction of each analysis segment. */
    instruments?: ValueTypes['AudioAnalysisV6InstrumentsSegments'];
    /** The instrument prediction of each analysis segment. */
    advancedInstruments?: ValueTypes['AudioAnalysisV7InstrumentsSegments'];
    /** The instrument prediction of each analysis segment. */
    advancedInstrumentsExtended?: ValueTypes['AudioAnalysisV7ExtendedInstrumentsSegments'];
    /** The genre prediction of each analysis segment. */
    genre?: ValueTypes['AudioAnalysisV6GenreSegments'];
    /** The sub-genre prediction of each analysis segment. */
    subgenre?: ValueTypes['AudioAnalysisV6SubgenreSegments'];
    /** The EDM subgenre prediction of each analysis segments. It is null if the track has not been recognized as EDM music. */
    subgenreEdm?: ValueTypes['AudioAnalysisV6SubgenreEdmSegments'];
    /** The valance prediction of each analysis segment. */
    valence?: boolean | `@${string}`;
    /** The arousal prediction of each analysis segment. */
    arousal?: boolean | `@${string}`;
    moodAdvanced?: ValueTypes['AudioAnalysisV6MoodAdvancedSegments'];
    movement?: ValueTypes['AudioAnalysisV6MovementSegments'];
    character?: ValueTypes['AudioAnalysisV6CharacterSegments'];
    classicalEpoch?: ValueTypes['AudioAnalysisV6ClassicalEpochSegments'];
    /** The genre prediction of each analysis segment. */
    advancedGenre?: ValueTypes['AudioAnalysisV7GenreSegments'];
    /** The sub-genre prediction of each analysis segment. */
    advancedSubgenre?: ValueTypes['AudioAnalysisV7SubgenreSegments'];
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6KeyPrediction']: AliasType<{
    /** The predicted Key value. */
    value?: boolean | `@${string}`;
    /** The confidence of predicted key value. */
    confidence?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6BPMPrediction']: AliasType<{
    /** The predicted BPM value. */
    value?: boolean | `@${string}`;
    /** The confidence of the predicted BPM value. */
    confidence?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV7InstrumentsSegments']: AliasType<{
    /** Segments prediction value for the "percussion" instrument presence. */
    percussion?: boolean | `@${string}`;
    /** Segments prediction value for the "synth" instrument presence. */
    synth?: boolean | `@${string}`;
    /** Segments prediction value for the "piano" instrument presence. */
    piano?: boolean | `@${string}`;
    /** Segments prediction value for the "acousticGuitar" instrument presence. */
    acousticGuitar?: boolean | `@${string}`;
    /** Segments prediction value for the "electricGuitar" instrument presence. */
    electricGuitar?: boolean | `@${string}`;
    /** Segments prediction value for the "strings" instrument presence. */
    strings?: boolean | `@${string}`;
    /** Segments prediction value for the "bass" instrument presence. */
    bass?: boolean | `@${string}`;
    /** Segments prediction value for the "bassGuitar" instrument presence. */
    bassGuitar?: boolean | `@${string}`;
    /** Segments prediction value for the "woodwinds" instrument presence. */
    woodwinds?: boolean | `@${string}`;
    /** Segments prediction value for the "brass" instrument presence. */
    brass?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Instruments detected by the instrument recognition. */
  ['AudioAnalysisV7InstrumentTags']: AudioAnalysisV7InstrumentTags;
  /** The intensity of an instrument's presence throughout a track. */
  ['AudioAnalysisV7InstrumentPresence']: AliasType<{
    /** Intensity of the percussion instrument. */
    percussion?: boolean | `@${string}`;
    /** Intensity of the synthesizer instrument. */
    synth?: boolean | `@${string}`;
    /** Intensity of the piano instrument. */
    piano?: boolean | `@${string}`;
    /** Intensity of the acoustic guitar instrument. */
    acousticGuitar?: boolean | `@${string}`;
    /** Intensity of the electric guitar instrument. */
    electricGuitar?: boolean | `@${string}`;
    /** Intensity of the strings instrument. */
    strings?: boolean | `@${string}`;
    /** Intensity of the bass instrument. */
    bass?: boolean | `@${string}`;
    /** Intensity of the bass guitar instrument. */
    bassGuitar?: boolean | `@${string}`;
    /** Intensity of the brass instrument. */
    brass?: boolean | `@${string}`;
    /** Intensity of the woodwinds instrument. */
    woodwinds?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV7ExtendedInstrumentsSegments']: AliasType<{
    acousticGuitar?: boolean | `@${string}`;
    bass?: boolean | `@${string}`;
    bassGuitar?: boolean | `@${string}`;
    electricGuitar?: boolean | `@${string}`;
    percussion?: boolean | `@${string}`;
    piano?: boolean | `@${string}`;
    synth?: boolean | `@${string}`;
    strings?: boolean | `@${string}`;
    brass?: boolean | `@${string}`;
    woodwinds?: boolean | `@${string}`;
    tuba?: boolean | `@${string}`;
    frenchHorn?: boolean | `@${string}`;
    oboe?: boolean | `@${string}`;
    mandolin?: boolean | `@${string}`;
    cello?: boolean | `@${string}`;
    marimba?: boolean | `@${string}`;
    vibraphone?: boolean | `@${string}`;
    electricPiano?: boolean | `@${string}`;
    electricOrgan?: boolean | `@${string}`;
    harp?: boolean | `@${string}`;
    ukulele?: boolean | `@${string}`;
    harpsichord?: boolean | `@${string}`;
    churchOrgan?: boolean | `@${string}`;
    doubleBass?: boolean | `@${string}`;
    xylophone?: boolean | `@${string}`;
    glockenspiel?: boolean | `@${string}`;
    electronicDrums?: boolean | `@${string}`;
    drumKit?: boolean | `@${string}`;
    accordion?: boolean | `@${string}`;
    violin?: boolean | `@${string}`;
    flute?: boolean | `@${string}`;
    sax?: boolean | `@${string}`;
    trumpet?: boolean | `@${string}`;
    celeste?: boolean | `@${string}`;
    pizzicato?: boolean | `@${string}`;
    banjo?: boolean | `@${string}`;
    clarinet?: boolean | `@${string}`;
    bells?: boolean | `@${string}`;
    steelDrums?: boolean | `@${string}`;
    bongoConga?: boolean | `@${string}`;
    africanPercussion?: boolean | `@${string}`;
    tabla?: boolean | `@${string}`;
    sitar?: boolean | `@${string}`;
    taiko?: boolean | `@${string}`;
    asianFlute?: boolean | `@${string}`;
    asianStrings?: boolean | `@${string}`;
    luteOud?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Instruments detected by the instrument recognition. */
  ['AudioAnalysisV7ExtendedInstrumentTags']: AudioAnalysisV7ExtendedInstrumentTags;
  /** The intensity of an instrument's presence throughout a track. */
  ['AudioAnalysisV7ExtendedInstrumentPresence']: AliasType<{
    acousticGuitar?: boolean | `@${string}`;
    bass?: boolean | `@${string}`;
    bassGuitar?: boolean | `@${string}`;
    electricGuitar?: boolean | `@${string}`;
    percussion?: boolean | `@${string}`;
    piano?: boolean | `@${string}`;
    synth?: boolean | `@${string}`;
    strings?: boolean | `@${string}`;
    brass?: boolean | `@${string}`;
    woodwinds?: boolean | `@${string}`;
    tuba?: boolean | `@${string}`;
    frenchHorn?: boolean | `@${string}`;
    oboe?: boolean | `@${string}`;
    mandolin?: boolean | `@${string}`;
    cello?: boolean | `@${string}`;
    marimba?: boolean | `@${string}`;
    vibraphone?: boolean | `@${string}`;
    electricPiano?: boolean | `@${string}`;
    electricOrgan?: boolean | `@${string}`;
    harp?: boolean | `@${string}`;
    ukulele?: boolean | `@${string}`;
    harpsichord?: boolean | `@${string}`;
    churchOrgan?: boolean | `@${string}`;
    doubleBass?: boolean | `@${string}`;
    xylophone?: boolean | `@${string}`;
    glockenspiel?: boolean | `@${string}`;
    electronicDrums?: boolean | `@${string}`;
    drumKit?: boolean | `@${string}`;
    accordion?: boolean | `@${string}`;
    violin?: boolean | `@${string}`;
    flute?: boolean | `@${string}`;
    sax?: boolean | `@${string}`;
    trumpet?: boolean | `@${string}`;
    celeste?: boolean | `@${string}`;
    pizzicato?: boolean | `@${string}`;
    banjo?: boolean | `@${string}`;
    clarinet?: boolean | `@${string}`;
    bells?: boolean | `@${string}`;
    steelDrums?: boolean | `@${string}`;
    bongoConga?: boolean | `@${string}`;
    africanPercussion?: boolean | `@${string}`;
    tabla?: boolean | `@${string}`;
    sitar?: boolean | `@${string}`;
    taiko?: boolean | `@${string}`;
    asianFlute?: boolean | `@${string}`;
    asianStrings?: boolean | `@${string}`;
    luteOud?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV7Genre']: AliasType<{
    /** Mean prediction value for the "afro" genre. */
    afro?: boolean | `@${string}`;
    /** Mean prediction value for the "ambient" genre. */
    ambient?: boolean | `@${string}`;
    /** Mean prediction value for the "arab" genre. */
    arab?: boolean | `@${string}`;
    /** Mean prediction value for the "asian" genre. */
    asian?: boolean | `@${string}`;
    /** Mean prediction value for the "blues" genre. */
    blues?: boolean | `@${string}`;
    /** Mean prediction value for the "children jingle" genre. */
    childrenJingle?: boolean | `@${string}`;
    /** Mean prediction value for the "classical" genre. */
    classical?: boolean | `@${string}`;
    /** Mean prediction value for the "electronic dance" genre. */
    electronicDance?: boolean | `@${string}`;
    /** Mean prediction value for the "folk country" genre. */
    folkCountry?: boolean | `@${string}`;
    /** Mean prediction value for the "funk soul" genre. */
    funkSoul?: boolean | `@${string}`;
    /** Mean prediction value for the "indian" genre. */
    indian?: boolean | `@${string}`;
    /** Mean prediction value for the "jazz" genre. */
    jazz?: boolean | `@${string}`;
    /** Mean prediction value for the "latin" genre. */
    latin?: boolean | `@${string}`;
    /** Mean prediction value for the "metal" genre. */
    metal?: boolean | `@${string}`;
    /** Mean prediction value for the "pop" genre. */
    pop?: boolean | `@${string}`;
    /** Mean prediction value for the "rap hip hop" genre. */
    rapHipHop?: boolean | `@${string}`;
    /** Mean prediction value for the "reggae" genre. */
    reggae?: boolean | `@${string}`;
    /** Mean prediction value for the "rnb" genre. */
    rnb?: boolean | `@${string}`;
    /** Mean prediction value for the "rock" genre. */
    rock?: boolean | `@${string}`;
    /** Mean prediction value for the "singer songwriters" genre. */
    singerSongwriters?: boolean | `@${string}`;
    /** Mean prediction value for the "sound" genre. */
    sound?: boolean | `@${string}`;
    /** Mean prediction value for the "soundtrack" genre. */
    soundtrack?: boolean | `@${string}`;
    /** Mean prediction value for the "spoken word" genre. */
    spokenWord?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV7GenreTags']: AudioAnalysisV7GenreTags;
  ['AudioAnalysisV7GenreSegments']: AliasType<{
    /** Segments prediction value for the "afro" genre */
    afro?: boolean | `@${string}`;
    /** Segments prediction value for the "ambient" genre */
    ambient?: boolean | `@${string}`;
    /** Segments prediction value for the "arab" genre */
    arab?: boolean | `@${string}`;
    /** Segments prediction value for the "asian" genre */
    asian?: boolean | `@${string}`;
    /** Segments prediction value for the "blues" genre */
    blues?: boolean | `@${string}`;
    /** Segments prediction value for the "childrenJingle" genre */
    childrenJingle?: boolean | `@${string}`;
    /** Segments prediction value for the "classical" genre */
    classical?: boolean | `@${string}`;
    /** Segments prediction value for the "electronicDance" genre */
    electronicDance?: boolean | `@${string}`;
    /** Segments prediction value for the "folkCountry" genre */
    folkCountry?: boolean | `@${string}`;
    /** Segments prediction value for the "funkSoul" genre */
    funkSoul?: boolean | `@${string}`;
    /** Segments prediction value for the "indian" genre */
    indian?: boolean | `@${string}`;
    /** Segments prediction value for the "jazz" genre */
    jazz?: boolean | `@${string}`;
    /** Segments prediction value for the "latin" genre */
    latin?: boolean | `@${string}`;
    /** Segments prediction value for the "metal" genre */
    metal?: boolean | `@${string}`;
    /** Segments prediction value for the "pop" genre */
    pop?: boolean | `@${string}`;
    /** Segments prediction value for the "rapHipHop" genre */
    rapHipHop?: boolean | `@${string}`;
    /** Segments prediction value for the "reggae" genre */
    reggae?: boolean | `@${string}`;
    /** Segments prediction value for the "rnb" genre */
    rnb?: boolean | `@${string}`;
    /** Segments prediction value for the "rock" genre */
    rock?: boolean | `@${string}`;
    /** Segments prediction value for the "singerSongwriters" genre */
    singerSongwriters?: boolean | `@${string}`;
    /** Segments prediction value for the "sound" genre */
    sound?: boolean | `@${string}`;
    /** Segments prediction value for the "soundtrack" genre */
    soundtrack?: boolean | `@${string}`;
    /** Segments prediction value for the "spokenWord" genre */
    spokenWord?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV7SubgenreSegments']: AliasType<{
    /** Segments prediction value for the "bluesRock" sub-genre. */
    bluesRock?: boolean | `@${string}`;
    /** Segments prediction value for the "folkRock" sub-genre. */
    folkRock?: boolean | `@${string}`;
    /** Segments prediction value for the "hardRock" sub-genre. */
    hardRock?: boolean | `@${string}`;
    /** Segments prediction value for the "indieAlternative" sub-genre. */
    indieAlternative?: boolean | `@${string}`;
    /** Segments prediction value for the "psychedelicProgressiveRock" sub-genre. */
    psychedelicProgressiveRock?: boolean | `@${string}`;
    /** Segments prediction value for the "punk" sub-genre. */
    punk?: boolean | `@${string}`;
    /** Segments prediction value for the "rockAndRoll" sub-genre. */
    rockAndRoll?: boolean | `@${string}`;
    /** Segments prediction value for the "popSoftRock" sub-genre. */
    popSoftRock?: boolean | `@${string}`;
    /** Segments prediction value for the "abstractIDMLeftfield" sub-genre. */
    abstractIDMLeftfield?: boolean | `@${string}`;
    /** Segments prediction value for the "breakbeatDnB" sub-genre. */
    breakbeatDnB?: boolean | `@${string}`;
    /** Segments prediction value for the "deepHouse" sub-genre. */
    deepHouse?: boolean | `@${string}`;
    /** Segments prediction value for the "electro" sub-genre. */
    electro?: boolean | `@${string}`;
    /** Segments prediction value for the "house" sub-genre. */
    house?: boolean | `@${string}`;
    /** Segments prediction value for the "minimal" sub-genre. */
    minimal?: boolean | `@${string}`;
    /** Segments prediction value for the "synthPop" sub-genre. */
    synthPop?: boolean | `@${string}`;
    /** Segments prediction value for the "techHouse" sub-genre. */
    techHouse?: boolean | `@${string}`;
    /** Segments prediction value for the "techno" sub-genre. */
    techno?: boolean | `@${string}`;
    /** Segments prediction value for the "trance" sub-genre. */
    trance?: boolean | `@${string}`;
    /** Segments prediction value for the "contemporaryRnB" sub-genre. */
    contemporaryRnB?: boolean | `@${string}`;
    /** Segments prediction value for the "gangsta" sub-genre. */
    gangsta?: boolean | `@${string}`;
    /** Segments prediction value for the "jazzyHipHop" sub-genre. */
    jazzyHipHop?: boolean | `@${string}`;
    /** Segments prediction value for the "popRap" sub-genre. */
    popRap?: boolean | `@${string}`;
    /** Segments prediction value for the "trap" sub-genre. */
    trap?: boolean | `@${string}`;
    /** Segments prediction value for the "blackMetal" sub-genre. */
    blackMetal?: boolean | `@${string}`;
    /** Segments prediction value for the "deathMetal" sub-genre. */
    deathMetal?: boolean | `@${string}`;
    /** Segments prediction value for the "doomMetal" sub-genre. */
    doomMetal?: boolean | `@${string}`;
    /** Segments prediction value for the "heavyMetal" sub-genre. */
    heavyMetal?: boolean | `@${string}`;
    /** Segments prediction value for the "metalcore" sub-genre. */
    metalcore?: boolean | `@${string}`;
    /** Segments prediction value for the "nuMetal" sub-genre. */
    nuMetal?: boolean | `@${string}`;
    /** Segments prediction value for the "disco" sub-genre. */
    disco?: boolean | `@${string}`;
    /** Segments prediction value for the "funk" sub-genre. */
    funk?: boolean | `@${string}`;
    /** Segments prediction value for the "gospel" sub-genre. */
    gospel?: boolean | `@${string}`;
    /** Segments prediction value for the "neoSoul" sub-genre. */
    neoSoul?: boolean | `@${string}`;
    /** Segments prediction value for the "soul" sub-genre. */
    soul?: boolean | `@${string}`;
    /** Segments prediction value for the "bigBandSwing" sub-genre. */
    bigBandSwing?: boolean | `@${string}`;
    /** Segments prediction value for the "bebop" sub-genre. */
    bebop?: boolean | `@${string}`;
    /** Segments prediction value for the "contemporaryJazz" sub-genre. */
    contemporaryJazz?: boolean | `@${string}`;
    /** Segments prediction value for the "easyListening" sub-genre. */
    easyListening?: boolean | `@${string}`;
    /** Segments prediction value for the "fusion" sub-genre. */
    fusion?: boolean | `@${string}`;
    /** Segments prediction value for the "latinJazz" sub-genre. */
    latinJazz?: boolean | `@${string}`;
    /** Segments prediction value for the "smoothJazz" sub-genre. */
    smoothJazz?: boolean | `@${string}`;
    /** Segments prediction value for the "country" sub-genre. */
    country?: boolean | `@${string}`;
    /** Segments prediction value for the "folk" sub-genre. */
    folk?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV7SubgenreTags']: AudioAnalysisV7SubgenreTags;
  ['AudioAnalysisV7Subgenre']: AliasType<{
    /** Mean prediction value for the "bluesRock" sub-genre. */
    bluesRock?: boolean | `@${string}`;
    /** Mean prediction value for the "folkRock" sub-genre. */
    folkRock?: boolean | `@${string}`;
    /** Mean prediction value for the "hardRock" sub-genre. */
    hardRock?: boolean | `@${string}`;
    /** Mean prediction value for the "indieAlternative" sub-genre. */
    indieAlternative?: boolean | `@${string}`;
    /** Mean prediction value for the "psychedelicProgressiveRock" sub-genre. */
    psychedelicProgressiveRock?: boolean | `@${string}`;
    /** Mean prediction value for the "punk" sub-genre. */
    punk?: boolean | `@${string}`;
    /** Mean prediction value for the "rockAndRoll" sub-genre. */
    rockAndRoll?: boolean | `@${string}`;
    /** Mean prediction value for the "popSoftRock" sub-genre. */
    popSoftRock?: boolean | `@${string}`;
    /** Mean prediction value for the "abstractIDMLeftfield" sub-genre. */
    abstractIDMLeftfield?: boolean | `@${string}`;
    /** Mean prediction value for the "breakbeatDnB" sub-genre. */
    breakbeatDnB?: boolean | `@${string}`;
    /** Mean prediction value for the "deepHouse" sub-genre. */
    deepHouse?: boolean | `@${string}`;
    /** Mean prediction value for the "electro" sub-genre. */
    electro?: boolean | `@${string}`;
    /** Mean prediction value for the "house" sub-genre. */
    house?: boolean | `@${string}`;
    /** Mean prediction value for the "minimal" sub-genre. */
    minimal?: boolean | `@${string}`;
    /** Mean prediction value for the "synthPop" sub-genre. */
    synthPop?: boolean | `@${string}`;
    /** Mean prediction value for the "techHouse" sub-genre. */
    techHouse?: boolean | `@${string}`;
    /** Mean prediction value for the "techno" sub-genre. */
    techno?: boolean | `@${string}`;
    /** Mean prediction value for the "trance" sub-genre. */
    trance?: boolean | `@${string}`;
    /** Mean prediction value for the "contemporaryRnB" sub-genre. */
    contemporaryRnB?: boolean | `@${string}`;
    /** Mean prediction value for the "gangsta" sub-genre. */
    gangsta?: boolean | `@${string}`;
    /** Mean prediction value for the "jazzyHipHop" sub-genre. */
    jazzyHipHop?: boolean | `@${string}`;
    /** Mean prediction value for the "popRap" sub-genre. */
    popRap?: boolean | `@${string}`;
    /** Mean prediction value for the "trap" sub-genre. */
    trap?: boolean | `@${string}`;
    /** Mean prediction value for the "blackMetal" sub-genre. */
    blackMetal?: boolean | `@${string}`;
    /** Mean prediction value for the "deathMetal" sub-genre. */
    deathMetal?: boolean | `@${string}`;
    /** Mean prediction value for the "doomMetal" sub-genre. */
    doomMetal?: boolean | `@${string}`;
    /** Mean prediction value for the "heavyMetal" sub-genre. */
    heavyMetal?: boolean | `@${string}`;
    /** Mean prediction value for the "metalcore" sub-genre. */
    metalcore?: boolean | `@${string}`;
    /** Mean prediction value for the "nuMetal" sub-genre. */
    nuMetal?: boolean | `@${string}`;
    /** Mean prediction value for the "disco" sub-genre. */
    disco?: boolean | `@${string}`;
    /** Mean prediction value for the "funk" sub-genre. */
    funk?: boolean | `@${string}`;
    /** Mean prediction value for the "gospel" sub-genre. */
    gospel?: boolean | `@${string}`;
    /** Mean prediction value for the "neoSoul" sub-genre. */
    neoSoul?: boolean | `@${string}`;
    /** Mean prediction value for the "soul" sub-genre. */
    soul?: boolean | `@${string}`;
    /** Mean prediction value for the "bigBandSwing" sub-genre. */
    bigBandSwing?: boolean | `@${string}`;
    /** Mean prediction value for the "bebop" sub-genre. */
    bebop?: boolean | `@${string}`;
    /** Mean prediction value for the "contemporaryJazz" sub-genre. */
    contemporaryJazz?: boolean | `@${string}`;
    /** Mean prediction value for the "easyListening" sub-genre. */
    easyListening?: boolean | `@${string}`;
    /** Mean prediction value for the "fusion" sub-genre. */
    fusion?: boolean | `@${string}`;
    /** Mean prediction value for the "latinJazz" sub-genre. */
    latinJazz?: boolean | `@${string}`;
    /** Mean prediction value for the "smoothJazz" sub-genre. */
    smoothJazz?: boolean | `@${string}`;
    /** Mean prediction value for the "country" sub-genre. */
    country?: boolean | `@${string}`;
    /** Mean prediction value for the "folk" sub-genre. */
    folk?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6Result']: AliasType<{
    /** The prediction results for the segments of the audio. */
    segments?: ValueTypes['AudioAnalysisV6Segments'];
    /** The multi-label genre prediction for the whole audio. */
    genre?: ValueTypes['AudioAnalysisV6Genre'];
    genreTags?: boolean | `@${string}`;
    /** The multi-label subgenre prediction for the whole audio. */
    subgenre?: ValueTypes['AudioAnalysisV6Subgenre'];
    /** List of subgenre tags the audio is classified with. */
    subgenreTags?: boolean | `@${string}`;
    subgenreEdm?: ValueTypes['AudioAnalysisV6SubgenreEdm'];
    subgenreEdmTags?: boolean | `@${string}`;
    /** The multi-label mood prediction for the whole audio. */
    mood?: ValueTypes['AudioAnalysisV6Mood'];
    /** List of mood tags the audio is classified with. */
    moodTags?: boolean | `@${string}`;
    moodMaxTimes?: ValueTypes['AudioAnalysisV6MaximumMoodInterval'];
    voice?: ValueTypes['AudioAnalysisV6Voice'];
    instruments?: ValueTypes['AudioAnalysisV6Instruments'];
    /** The presence of instruments of the audio. */
    instrumentPresence?: ValueTypes['AudioAnalysisV6InstrumentPresence'];
    /** List of instrument tags the audio is classified with. */
    instrumentTags?: boolean | `@${string}`;
    /** BPM of the track. */
    bpm?: boolean | `@${string}`;
    /** BPM predicted for the track. */
    bpmPrediction?: ValueTypes['AudioAnalysisV6BPMPrediction'];
    /** The global estimated bpm value of the full track fixed to a custom range of 60-180 bpm. */
    bpmRangeAdjusted?: boolean | `@${string}`;
    /** The key predicted for the track. */
    key?: boolean | `@${string}`;
    /** The key predicted for the track. */
    keyPrediction?: ValueTypes['AudioAnalysisV6KeyPrediction'];
    /** Time signature of the track. */
    timeSignature?: boolean | `@${string}`;
    /** The overall valance of the audio. */
    valence?: boolean | `@${string}`;
    /** The overall arousal of the audio. */
    arousal?: boolean | `@${string}`;
    /** The overall energy level of the audio. */
    energyLevel?: boolean | `@${string}`;
    /** The overall energy dynamics of the audio. */
    energyDynamics?: boolean | `@${string}`;
    /** The overall emotional profile of the audio. */
    emotionalProfile?: boolean | `@${string}`;
    /** The overall voice presence profile of the audio. */
    voicePresenceProfile?: boolean | `@${string}`;
    /** The overall emotional dynamics of the audio. */
    emotionalDynamics?: boolean | `@${string}`;
    /** The predominant voice gender of the audio. */
    predominantVoiceGender?: boolean | `@${string}`;
    /** The predicted musical era of the audio. */
    musicalEraTag?: boolean | `@${string}`;
    voiceTags?: boolean | `@${string}`;
    moodAdvanced?: ValueTypes['AudioAnalysisV6MoodAdvanced'];
    moodAdvancedTags?: boolean | `@${string}`;
    movement?: ValueTypes['AudioAnalysisV6Movement'];
    movementTags?: boolean | `@${string}`;
    character?: ValueTypes['AudioAnalysisV6Character'];
    characterTags?: boolean | `@${string}`;
    /** This field is only available for music classified as classical. */
    classicalEpoch?: ValueTypes['AudioAnalysisV6ClassicalEpoch'];
    /** This field is only available for music classified as classical. */
    classicalEpochTags?: boolean | `@${string}`;
    transformerCaption?: boolean | `@${string}`;
    /** The multi-label genre prediction for the whole audio. */
    advancedGenre?: ValueTypes['AudioAnalysisV7Genre'];
    advancedGenreTags?: boolean | `@${string}`;
    /** The multi-label subgenre prediction for the whole audio. */
    advancedSubgenre?: ValueTypes['AudioAnalysisV7Subgenre'];
    /** List of subgenre tags the audio is classified with. */
    advancedSubgenreTags?: boolean | `@${string}`;
    /** The presence of instruments of the audio. */
    advancedInstrumentPresence?: ValueTypes['AudioAnalysisV7InstrumentPresence'];
    /** List of instrument tags the audio is classified with. */
    advancedInstrumentTags?: boolean | `@${string}`;
    /** The presence of instruments of the audio. */
    advancedInstrumentPresenceExtended?: ValueTypes['AudioAnalysisV7ExtendedInstrumentPresence'];
    /** List of instrument tags the audio is classified with. */
    advancedInstrumentTagsExtended?: boolean | `@${string}`;
    /** The existence of the voiceover in this track */
    voiceoverExists?: boolean | `@${string}`;
    /** The degree of certainty that there is a voiceover */
    voiceoverDegree?: boolean | `@${string}`;
    freeGenreTags?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['LibraryTrack']: AliasType<{
    audioAnalysisV6?: ValueTypes['AudioAnalysisV6'];
    /** The primary identifier. */
    id?: boolean | `@${string}`;
    /** The title of the track.
Can be specified when creating the track. */
    title?: boolean | `@${string}`;
    /** An optional external identifier
Can be specified when creating the track. */
    externalId?: boolean | `@${string}`;
    similarLibraryTracks?: [
      {
        /** When specifying crate id, the returned connection will return only tracks from that crate. */
        crateIdFilter?:
          | string
          | undefined
          | null
          | Variable<
              any,
              string
            > /** Amount of items to fetch. The maximum is 100. */;
        first?: number | undefined | null | Variable<any, string>;
      },
      ValueTypes['SimilarLibraryTracksResult'],
    ];
    similarTracks?: [
      {
        /** Amount of items to fetch. */
        first?:
          | number
          | undefined
          | null
          | Variable<
              any,
              string
            > /** The relevant parts of the track that should be used for the similarity search. */;
        searchMode?:
          | ValueTypes['SimilarTracksSearchMode']
          | undefined
          | null
          | Variable<
              any,
              string
            > /** What kind of results should be returned? Either Spotify or Library tracks. */;
        target:
          | ValueTypes['SimilarTracksTarget']
          | Variable<
              any,
              string
            > /** Filters to apply on to the similarity search. */;
        experimental_filter?:
          | ValueTypes['experimental_SimilarTracksFilter']
          | undefined
          | null
          | Variable<any, string>;
      },
      ValueTypes['SimilarTracksResult'],
    ];
    /** Augmented keywords that can be associated with the audio. */
    augmentedKeywords?: ValueTypes['AugmentedKeywordsResult'];
    /** Brand values that can be associated with the audio. */
    brandValues?: ValueTypes['BrandValuesResult'];
    __typename?: boolean | `@${string}`;
  }>;
  /** Represents a track on Spotify. */
  ['SpotifyTrack']: AliasType<{
    audioAnalysisV6?: ValueTypes['AudioAnalysisV6'];
    /** The ID of the track on Spotify. It can be used for fetching additional information for the Spotify API.
For further information check out the Spotify Web API Documentation. https://developer.spotify.com/documentation/web-api/ */
    id?: boolean | `@${string}`;
    title?: boolean | `@${string}`;
    similarTracks?: [
      {
        /** Amount of items to fetch. */
        first?:
          | number
          | undefined
          | null
          | Variable<
              any,
              string
            > /** The relevant parts of the track that should be used for the similarity search. */;
        searchMode?:
          | ValueTypes['SimilarTracksSearchMode']
          | undefined
          | null
          | Variable<
              any,
              string
            > /** What kind of results should be returned? Either Spotify or Library tracks. */;
        target:
          | ValueTypes['SimilarTracksTarget']
          | Variable<
              any,
              string
            > /** Filters to apply on to the similarity search. */;
        experimental_filter?:
          | ValueTypes['experimental_SimilarTracksFilter']
          | undefined
          | null
          | Variable<any, string>;
      },
      ValueTypes['SimilarTracksResult'],
    ];
    /** Augmented keywords that can be associated with the audio. */
    augmentedKeywords?: ValueTypes['AugmentedKeywordsResult'];
    /** Brand values that can be associated with the audio. */
    brandValues?: ValueTypes['BrandValuesResult'];
    __typename?: boolean | `@${string}`;
  }>;
  ['LibraryTrackNotFoundError']: AliasType<{
    message?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['LibraryTrackResult']: AliasType<{
    ['...on LibraryTrackNotFoundError']: ValueTypes['LibraryTrackNotFoundError'];
    ['...on LibraryTrack']: ValueTypes['LibraryTrack'];
    __typename?: boolean | `@${string}`;
  }>;
  ['LibraryTrackEdge']: AliasType<{
    cursor?: boolean | `@${string}`;
    node?: ValueTypes['LibraryTrack'];
    __typename?: boolean | `@${string}`;
  }>;
  ['LibraryTrackConnection']: AliasType<{
    edges?: ValueTypes['LibraryTrackEdge'];
    pageInfo?: ValueTypes['PageInfo'];
    __typename?: boolean | `@${string}`;
  }>;
  /** An error code returned when there is a problem with retrieving similar tracks. */
  ['SimilarLibraryTracksErrorCode']: SimilarLibraryTracksErrorCode;
  /** An error object returned if an error occurred while retrieving similar tracks. */
  ['SimilarLibraryTracksError']: AliasType<{
    message?: boolean | `@${string}`;
    code?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Describes the possible types the 'LibraryTrack.similarLibraryTracks' field can return. */
  ['SimilarLibraryTracksResult']: AliasType<{
    ['...on SimilarLibraryTracksError']: ValueTypes['SimilarLibraryTracksError'];
    ['...on SimilarLibraryTrackConnection']: ValueTypes['SimilarLibraryTrackConnection'];
    __typename?: boolean | `@${string}`;
  }>;
  /** Filter the LibraryTrackConnection. @oneOf */
  ['LibraryTracksFilter']: {
    /** Find library tracks whose title includes a specific substring. */
    title?: string | undefined | null | Variable<any, string>;
    /** Find library tracks whose source audio file sha256 hash matches. */
    sha256?: string | undefined | null | Variable<any, string>;
    /** Find library tracks whose external id matches. */
    externalId?: string | undefined | null | Variable<any, string>;
  };
  ['CratesConnection']: AliasType<{
    edges?: ValueTypes['CrateEdge'];
    pageInfo?: ValueTypes['PageInfo'];
    __typename?: boolean | `@${string}`;
  }>;
  ['CrateEdge']: AliasType<{
    cursor?: boolean | `@${string}`;
    node?: ValueTypes['Crate'];
    __typename?: boolean | `@${string}`;
  }>;
  /** A type representing a crate on the Cyanite platform. */
  ['Crate']: AliasType<{
    id?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Error codes that can be returned by the 'crateCreate' mutation. */
  ['CrateCreateErrorCode']: CrateCreateErrorCode;
  /** An error object returned if an error occurred while creating a crate. */
  ['CrateCreateError']: AliasType<{
    message?: boolean | `@${string}`;
    code?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Input for 'crateDelete' Mutation. */
  ['CrateDeleteInput']: {
    /** Id of the crate that will be deleted. */
    id: string | Variable<any, string>;
  };
  /** Input for 'crateCreate' Mutation. */
  ['CrateCreateInput']: {
    /** The name of the crate to be created. */
    name: string | Variable<any, string>;
  };
  /** Input for 'crateAddLibraryTracks' Mutation. */
  ['CrateAddLibraryTracksInput']: {
    /** Tracks that will be put into the crate. */
    libraryTrackIds: Array<string> | Variable<any, string>;
    /** Target crate id. */
    crateId: string | Variable<any, string>;
  };
  /** Input for 'crateRemoveLibraryTracks' Mutation. */
  ['CrateRemoveLibraryTracksInput']: {
    /** Tracks that will be removed from the crate. */
    libraryTrackIds: Array<string> | Variable<any, string>;
    /** Target crate id. */
    crateId: string | Variable<any, string>;
  };
  /** Describes the possible types that the 'crateCreate' Mutation can return. */
  ['CrateCreateResult']: AliasType<{
    ['...on CrateCreateSuccess']: ValueTypes['CrateCreateSuccess'];
    ['...on CrateCreateError']: ValueTypes['CrateCreateError'];
    __typename?: boolean | `@${string}`;
  }>;
  /** The crate was created successfully. */
  ['CrateCreateSuccess']: AliasType<{
    /** Id of the newly created crate. */
    id?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Describes the possible types that the 'crateDelete' Mutation can return. */
  ['CrateDeleteResult']: AliasType<{
    ['...on CrateDeleteSuccess']: ValueTypes['CrateDeleteSuccess'];
    ['...on CrateDeleteError']: ValueTypes['CrateDeleteError'];
    __typename?: boolean | `@${string}`;
  }>;
  /** The crate was deleted successfully. */
  ['CrateDeleteSuccess']: AliasType<{
    _?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Error codes that can be returned by the 'crateDelete' Mutation. */
  ['CrateDeleteErrorCode']: CrateDeleteErrorCode;
  /** An error object returned if an error occurred while deleting a crate. */
  ['CrateDeleteError']: AliasType<{
    message?: boolean | `@${string}`;
    code?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Describes the possible types that the 'crateAddLibraryTracks' Mutation can return. */
  ['CrateAddLibraryTracksResult']: AliasType<{
    ['...on CrateAddLibraryTracksSuccess']: ValueTypes['CrateAddLibraryTracksSuccess'];
    ['...on CrateAddLibraryTracksError']: ValueTypes['CrateAddLibraryTracksError'];
    __typename?: boolean | `@${string}`;
  }>;
  /** The tracks were successfully added to the crate. */
  ['CrateAddLibraryTracksSuccess']: AliasType<{
    /** The IDs of the library tracks that were added to the crate. */
    addedLibraryTrackIds?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An error object returned if an error occurred while adding the tracks to the crate. */
  ['CrateAddLibraryTracksError']: AliasType<{
    message?: boolean | `@${string}`;
    code?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Error codes that can be returned by the 'crateAddLibraryTracks' Mutation. */
  ['CrateAddLibraryTracksErrorCode']: CrateAddLibraryTracksErrorCode;
  /** Describes the possible types that the 'crateRemoveLibraryTracks' Mutation can return. */
  ['CrateRemoveLibraryTracksResult']: AliasType<{
    ['...on CrateRemoveLibraryTracksSuccess']: ValueTypes['CrateRemoveLibraryTracksSuccess'];
    ['...on CrateRemoveLibraryTracksError']: ValueTypes['CrateRemoveLibraryTracksError'];
    __typename?: boolean | `@${string}`;
  }>;
  /** The tracks were successfully removed from the crate. */
  ['CrateRemoveLibraryTracksSuccess']: AliasType<{
    /** The IDs of the library tracks that were removed from the crate. */
    removedLibraryTrackIds?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Error codes that can be returned by the 'crateRemoveLibraryTracks' Mutation. */
  ['CrateRemoveLibraryTracksError']: AliasType<{
    message?: boolean | `@${string}`;
    code?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Error codes that can be returned by the 'crateRemoveLibraryTracks' Mutation. */
  ['CrateRemoveLibraryTracksErrorCode']: CrateRemoveLibraryTracksErrorCode;
  ['LibraryTrackCreateInput']: {
    /** The id of the upload requested via the 'fileUploadRequest' Mutation. */
    uploadId: string | Variable<any, string>;
    /** An optional title that is set for the 'LibraryTrack'.
The character limit for the title is 150. */
    title?: string | undefined | null | Variable<any, string>;
    /** An optional external identifier that is set for the 'LibraryTrack'.
The character limit for the external id is 150. */
    externalId?: string | undefined | null | Variable<any, string>;
  };
  /** Describes a successful LibraryTrack creation. */
  ['LibraryTrackCreateSuccess']: AliasType<{
    /** The newly created LibraryTrack. */
    createdLibraryTrack?: ValueTypes['LibraryTrack'];
    /** Whether the track was enqueued successfully or not. */
    enqueueResult?: ValueTypes['LibraryTrackEnqueueResult'];
    __typename?: boolean | `@${string}`;
  }>;
  ['LibraryTrackCreateErrorCode']: LibraryTrackCreateErrorCode;
  /** Describes a failed LibraryTrack creation. */
  ['LibraryTrackCreateError']: AliasType<{
    /** An error that describes the reason for the failed LibraryTrack creation. */
    code?: boolean | `@${string}`;
    /** A human readable message that describes the reason for the failed LibraryTrack creation. */
    message?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Describes the possible types the 'libraryTrackCreate' Mutation can return. */
  ['LibraryTrackCreateResult']: AliasType<{
    ['...on LibraryTrackCreateSuccess']: ValueTypes['LibraryTrackCreateSuccess'];
    ['...on LibraryTrackCreateError']: ValueTypes['LibraryTrackCreateError'];
    __typename?: boolean | `@${string}`;
  }>;
  ['LibraryTrackEnqueueSuccess']: AliasType<{
    enqueuedLibraryTrack?: ValueTypes['LibraryTrack'];
    __typename?: boolean | `@${string}`;
  }>;
  ['LibraryTrackEnqueueErrorCode']: LibraryTrackEnqueueErrorCode;
  ['LibraryTrackEnqueueError']: AliasType<{
    /** An error that describes the reason for the failed LibraryTrack creation. */
    code?: boolean | `@${string}`;
    /** A human readable message that describes the reason for the failed LibraryTrack creation. */
    message?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['LibraryTrackEnqueueResult']: AliasType<{
    ['...on LibraryTrackEnqueueSuccess']: ValueTypes['LibraryTrackEnqueueSuccess'];
    ['...on LibraryTrackEnqueueError']: ValueTypes['LibraryTrackEnqueueError'];
    __typename?: boolean | `@${string}`;
  }>;
  ['LibraryTrackEnqueueInput']: {
    /** The id of the LibraryTrack that should be enqueued. */
    libraryTrackId: string | Variable<any, string>;
  };
  /** Describes the possible types the 'libraryTracksDelete' Mutation can return. */
  ['LibraryTracksDeleteResult']: AliasType<{
    ['...on LibraryTracksDeleteSuccess']: ValueTypes['LibraryTracksDeleteSuccess'];
    ['...on LibraryTracksDeleteError']: ValueTypes['LibraryTracksDeleteError'];
    __typename?: boolean | `@${string}`;
  }>;
  ['LibraryTracksDeleteErrorCode']: LibraryTracksDeleteErrorCode;
  ['LibraryTracksDeleteError']: AliasType<{
    /** Error code. */
    code?: boolean | `@${string}`;
    /** A human readable message that describes why the operation has failed. */
    message?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['LibraryTracksDeleteSuccess']: AliasType<{
    /** The IDs of deleted LibraryTracks. */
    libraryTrackIds?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['LibraryTracksDeleteInput']: {
    /** The IDs of the LibraryTracks that should be deleted. */
    libraryTrackIds: Array<string> | Variable<any, string>;
  };
  ['YouTubeTrackEnqueueResult']: AliasType<{
    ['...on YouTubeTrackEnqueueError']: ValueTypes['YouTubeTrackEnqueueError'];
    ['...on YouTubeTrackEnqueueSuccess']: ValueTypes['YouTubeTrackEnqueueSuccess'];
    __typename?: boolean | `@${string}`;
  }>;
  ['YouTubeTrackEnqueueErrorCode']: YouTubeTrackEnqueueErrorCode;
  ['YouTubeTrackEnqueueError']: AliasType<{
    /** A human readable message that describes why the operation has failed. */
    message?: boolean | `@${string}`;
    /** Error code if applicable */
    code?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['YouTubeTrackEnqueueSuccess']: AliasType<{
    enqueuedLibraryTrack?: ValueTypes['LibraryTrack'];
    __typename?: boolean | `@${string}`;
  }>;
  ['YouTubeTrackEnqueueInput']: {
    /** YouTube video URL */
    videoUrl: string | Variable<any, string>;
  };
  ['SpotifyTrackError']: AliasType<{
    message?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['SpotifyTrackResult']: AliasType<{
    ['...on SpotifyTrackError']: ValueTypes['SpotifyTrackError'];
    ['...on SpotifyTrack']: ValueTypes['SpotifyTrack'];
    __typename?: boolean | `@${string}`;
  }>;
  ['SpotifyTrackEnqueueInput']: {
    spotifyTrackId: string | Variable<any, string>;
  };
  ['SpotifyTrackEnqueueError']: AliasType<{
    message?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['SpotifyTrackEnqueueSuccess']: AliasType<{
    enqueuedSpotifyTrack?: ValueTypes['SpotifyTrack'];
    __typename?: boolean | `@${string}`;
  }>;
  ['SpotifyTrackEnqueueResult']: AliasType<{
    ['...on SpotifyTrackEnqueueError']: ValueTypes['SpotifyTrackEnqueueError'];
    ['...on SpotifyTrackEnqueueSuccess']: ValueTypes['SpotifyTrackEnqueueSuccess'];
    __typename?: boolean | `@${string}`;
  }>;
  /** Possible error codes of 'Track.similarTracks'. */
  ['SimilarTracksErrorCode']: SimilarTracksErrorCode;
  /** An error object returned if an error occurred while performing a similarity search. */
  ['SimilarTracksError']: AliasType<{
    code?: boolean | `@${string}`;
    message?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['SimilarTracksEdge']: AliasType<{
    cursor?: boolean | `@${string}`;
    node?: ValueTypes['Track'];
    __typename?: boolean | `@${string}`;
  }>;
  ['SimilarTracksConnection']: AliasType<{
    pageInfo?: ValueTypes['PageInfo'];
    edges?: ValueTypes['SimilarTracksEdge'];
    __typename?: boolean | `@${string}`;
  }>;
  /** Describes the possible types that the 'Track.similarTracks' field can return. */
  ['SimilarTracksResult']: AliasType<{
    ['...on SimilarTracksError']: ValueTypes['SimilarTracksError'];
    ['...on SimilarTracksConnection']: ValueTypes['SimilarTracksConnection'];
    __typename?: boolean | `@${string}`;
  }>;
  /** Musical keys */
  ['MusicalKey']: MusicalKey;
  /** List of musical genres. */
  ['MusicalGenre']: MusicalGenre;
  ['SimilarTracksSearchModeInterval']: {
    /** Start of the interval in seconds. */
    start: number | Variable<any, string>;
    /** End of the interval in seconds. */
    end: number | Variable<any, string>;
  };
  /** The search mode used for the similarity search.
Only one of the fields of this input type should be provided.
By default the 'mostRepresentative' mode will be used.

@oneOf */
  ['SimilarTracksSearchMode']: {
    /** Use the part of the track that is most representative as the criteria for finding similar tracks (Default mode). */
    mostRepresentative?: boolean | undefined | null | Variable<any, string>;
    /** Use the complete track as the criteria for finding similar tracks. */
    complete?: boolean | undefined | null | Variable<any, string>;
    /** Use the part of the track specified by the interval as the criteria for finding similar tracks. */
    interval?:
      | ValueTypes['SimilarTracksSearchModeInterval']
      | undefined
      | null
      | Variable<any, string>;
  };
  /** Return similar tracks from a library. */
  ['SimilarTracksTargetLibrary']: {
    _?: boolean | undefined | null | Variable<any, string>;
  };
  /** Return similar tracks from Spotify. */
  ['SimilarTracksTargetSpotify']: {
    _?: boolean | undefined | null | Variable<any, string>;
  };
  /** Return similar tracks from a crate. */
  ['SimilarTracksTargetCrate']: {
    /** The crate id from which similar tracks should be returned. */
    crateId: string | Variable<any, string>;
  };
  /** SimilarTracksTarget
Only one of the fields of this input type should be provided.
@oneOf */
  ['SimilarTracksTarget']: {
    /** Return LibraryTrack results. */
    library?:
      | ValueTypes['SimilarTracksTargetLibrary']
      | undefined
      | null
      | Variable<any, string>;
    /** Return LibraryTracks from a specific crate. */
    crate?:
      | ValueTypes['SimilarTracksTargetCrate']
      | undefined
      | null
      | Variable<any, string>;
    /** Return SpotifyTrack results. */
    spotify?:
      | ValueTypes['SimilarTracksTargetSpotify']
      | undefined
      | null
      | Variable<any, string>;
  };
  ['experimental_SimilarTracksFilterBpmInput']: {
    _?: boolean | undefined | null | Variable<any, string>;
  };
  ['experimental_SimilarTracksFilterBpmRange']: {
    start: number | Variable<any, string>;
    end: number | Variable<any, string>;
  };
  /** The BPM filter config.
Only one of the fields of this input type should be provided.
@oneOf */
  ['experimental_SimilarTracksFilterBpm']: {
    /** Use a BPM range around the input track (+-6%) */
    input?:
      | ValueTypes['experimental_SimilarTracksFilterBpmInput']
      | undefined
      | null
      | Variable<any, string>;
    /** Use a custom BPM range */
    range?:
      | ValueTypes['experimental_SimilarTracksFilterBpmRange']
      | undefined
      | null
      | Variable<any, string>;
  };
  ['experimental_SimilarTracksFilterGenreInput']: {
    _?: boolean | undefined | null | Variable<any, string>;
  };
  /** The Genre filter config.
Only one of the fields of this input type should be provided.
@oneOf */
  ['experimental_SimilarTracksFilterGenre']: {
    /** Use a genre from the input track */
    input?:
      | ValueTypes['experimental_SimilarTracksFilterGenreInput']
      | undefined
      | null
      | Variable<any, string>;
    /** Use a list of genres to filter for */
    list?:
      | Array<ValueTypes['MusicalGenre']>
      | undefined
      | null
      | Variable<any, string>;
  };
  ['experimental_SimilarTracksFilterKeyCamelotInput']: {
    _?: boolean | undefined | null | Variable<any, string>;
  };
  /** The Camelot key filter config.
Only one of the fields of this input type should be provided.
SimilarTracksKeyFilter @oneOf */
  ['experimental_SimilarTracksFilterKeyCamelot']: {
    /** Use key from the input track. */
    input?:
      | ValueTypes['experimental_SimilarTracksFilterKeyCamelotInput']
      | undefined
      | null
      | Variable<any, string>;
    /** Use custom key. */
    key?: ValueTypes['MusicalKey'] | undefined | null | Variable<any, string>;
  };
  ['experimental_SimilarTracksFilterKeyMatchingInput']: {
    _?: boolean | undefined | null | Variable<any, string>;
  };
  /** The key key filter config.
Only one of the fields of this input type should be provided.
SimilarTracksKeyFilter @oneOf */
  ['experimental_SimilarTracksFilterKeyMatching']: {
    /** Use key from the input track. */
    input?:
      | ValueTypes['experimental_SimilarTracksFilterKeyMatchingInput']
      | undefined
      | null
      | Variable<any, string>;
    /** Use list of custom keys. */
    list?:
      | Array<ValueTypes['MusicalKey']>
      | undefined
      | null
      | Variable<any, string>;
  };
  /** The Key filter config.
Only one of the fields of this input type should be provided.
@oneOf */
  ['experimental_SimilarTracksFilterKey']: {
    /** When set, will use Camelot filtering. */
    camelot?:
      | ValueTypes['experimental_SimilarTracksFilterKeyCamelot']
      | undefined
      | null
      | Variable<any, string>;
    /** When set, will use key filtering. */
    matching?:
      | ValueTypes['experimental_SimilarTracksFilterKeyMatching']
      | undefined
      | null
      | Variable<any, string>;
  };
  /** Describes the possible filters that can be applied for the search. */
  ['experimental_SimilarTracksFilter']: {
    /** Filter the search results by a BPM range. */
    bpm?:
      | ValueTypes['experimental_SimilarTracksFilterBpm']
      | undefined
      | null
      | Variable<any, string>;
    /** Filter the search results by a list of genres. */
    genre?:
      | ValueTypes['experimental_SimilarTracksFilterGenre']
      | undefined
      | null
      | Variable<any, string>;
    /** Filter the search results by one of the possible key filters.
Default: no key filter applied */
    key?:
      | ValueTypes['experimental_SimilarTracksFilterKey']
      | undefined
      | null
      | Variable<any, string>;
  };
  ['KeywordSearchKeyword']: {
    weight: number | Variable<any, string>;
    keyword: string | Variable<any, string>;
  };
  /** An error code returned when there is a problem with retrieving similar tracks. */
  ['KeywordSearchErrorCode']: KeywordSearchErrorCode;
  ['KeywordSearchError']: AliasType<{
    message?: boolean | `@${string}`;
    code?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['KeywordSearchResult']: AliasType<{
    ['...on KeywordSearchConnection']: ValueTypes['KeywordSearchConnection'];
    ['...on KeywordSearchError']: ValueTypes['KeywordSearchError'];
    __typename?: boolean | `@${string}`;
  }>;
  ['Keyword']: AliasType<{
    keyword?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['KeywordEdge']: AliasType<{
    node?: ValueTypes['Keyword'];
    cursor?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['KeywordConnection']: AliasType<{
    pageInfo?: ValueTypes['PageInfo'];
    edges?: ValueTypes['KeywordEdge'];
    __typename?: boolean | `@${string}`;
  }>;
  /** Return tracks from a library. */
  ['KeywordSearchTargetLibrary']: {
    _?: boolean | undefined | null | Variable<any, string>;
  };
  /** Return tracks from a crate. */
  ['KeywordSearchTargetCrate']: {
    /** The crate id from which tracks should be returned. */
    crateId: string | Variable<any, string>;
  };
  /** Return similar tracks from Spotify. */
  ['KeywordSearchTargetSpotify']: {
    _?: boolean | undefined | null | Variable<any, string>;
  };
  /** KeywordSearchTarget
Only one of the fields of this input type should be provided.
@oneOf */
  ['KeywordSearchTarget']: {
    /** Return LibraryTrack results. */
    library?:
      | ValueTypes['KeywordSearchTargetLibrary']
      | undefined
      | null
      | Variable<any, string>;
    /** Return LibraryTracks from a specific crate. */
    crate?:
      | ValueTypes['KeywordSearchTargetCrate']
      | undefined
      | null
      | Variable<any, string>;
    /** Return SpotifyTrack results. */
    spotify?:
      | ValueTypes['KeywordSearchTargetSpotify']
      | undefined
      | null
      | Variable<any, string>;
  };
  ['KeywordSearchEdge']: AliasType<{
    node?: ValueTypes['Track'];
    cursor?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['KeywordSearchConnection']: AliasType<{
    pageInfo?: ValueTypes['PageInfo'];
    edges?: ValueTypes['KeywordSearchEdge'];
    __typename?: boolean | `@${string}`;
  }>;
  ['AugmentedKeyword']: AliasType<{
    keyword?: boolean | `@${string}`;
    weight?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AugmentedKeywords']: AliasType<{
    keywords?: ValueTypes['AugmentedKeyword'];
    __typename?: boolean | `@${string}`;
  }>;
  ['AugmentedKeywordsErrorCode']: AugmentedKeywordsErrorCode;
  ['AugmentedKeywordsError']: AliasType<{
    message?: boolean | `@${string}`;
    code?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AugmentedKeywordsResult']: AliasType<{
    ['...on AugmentedKeywordsError']: ValueTypes['AugmentedKeywordsError'];
    ['...on AugmentedKeywords']: ValueTypes['AugmentedKeywords'];
    __typename?: boolean | `@${string}`;
  }>;
  ['BrandValuesSuccess']: AliasType<{
    values?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['SelectBrandValuesInput']: {
    /** Values must comply with available brand values */
    values: Array<string> | Variable<any, string>;
  };
  ['SelectBrandValuesSuccess']: AliasType<{
    success?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['SelectBrandValuesResult']: AliasType<{
    ['...on BrandValuesError']: ValueTypes['BrandValuesError'];
    ['...on SelectBrandValuesSuccess']: ValueTypes['SelectBrandValuesSuccess'];
    __typename?: boolean | `@${string}`;
  }>;
  ['BrandValuesResult']: AliasType<{
    ['...on BrandValuesError']: ValueTypes['BrandValuesError'];
    ['...on BrandValuesSuccess']: ValueTypes['BrandValuesSuccess'];
    ['...on BrandValues']: ValueTypes['BrandValues'];
    __typename?: boolean | `@${string}`;
  }>;
  ['BrandValue']: AliasType<{
    value?: boolean | `@${string}`;
    weight?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['BrandValues']: AliasType<{
    values?: ValueTypes['BrandValue'];
    __typename?: boolean | `@${string}`;
  }>;
  ['BrandValuesErrorCode']: BrandValuesErrorCode;
  ['BrandValuesError']: AliasType<{
    message?: boolean | `@${string}`;
    code?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['FreeTextSearchErrorCode']: FreeTextSearchErrorCode;
  ['FreeTextSearchTargetLibrary']: {
    libraryUserId?: string | undefined | null | Variable<any, string>;
  };
  ['FreeTextSearchTargetCrate']: {
    crateId: string | Variable<any, string>;
  };
  ['FreeTextSearchTargetSpotify']: {
    _?: boolean | undefined | null | Variable<any, string>;
  };
  ['FreeTextSearchTarget']: {
    library?:
      | ValueTypes['FreeTextSearchTargetLibrary']
      | undefined
      | null
      | Variable<any, string>;
    crate?:
      | ValueTypes['FreeTextSearchTargetCrate']
      | undefined
      | null
      | Variable<any, string>;
    spotify?:
      | ValueTypes['FreeTextSearchTargetSpotify']
      | undefined
      | null
      | Variable<any, string>;
  };
  ['FreeTextSearchError']: AliasType<{
    code?: boolean | `@${string}`;
    message?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['FreeTextSearchEdge']: AliasType<{
    cursor?: boolean | `@${string}`;
    node?: ValueTypes['Track'];
    __typename?: boolean | `@${string}`;
  }>;
  ['FreeTextSearchConnection']: AliasType<{
    pageInfo?: ValueTypes['PageInfo'];
    edges?: ValueTypes['FreeTextSearchEdge'];
    __typename?: boolean | `@${string}`;
  }>;
  /** Describes the possible types that the 'freeTextSearch' field can return. */
  ['FreeTextSearchResult']: AliasType<{
    ['...on FreeTextSearchError']: ValueTypes['FreeTextSearchError'];
    ['...on FreeTextSearchConnection']: ValueTypes['FreeTextSearchConnection'];
    __typename?: boolean | `@${string}`;
  }>;
  ['LyricsSearchErrorCode']: LyricsSearchErrorCode;
  /** The Spotify target for lyrics search */
  ['LyricsSearchTargetSpotify']: {
    _?: boolean | undefined | null | Variable<any, string>;
  };
  /** Search target to perform the lyrics search on. Currently only Spotify is available. */
  ['LyricsSearchTarget']: {
    spotify?:
      | ValueTypes['LyricsSearchTargetSpotify']
      | undefined
      | null
      | Variable<any, string>;
  };
  /** Error type if search cannot be performed. Contains the code and a message. */
  ['LyricsSearchError']: AliasType<{
    code?: boolean | `@${string}`;
    message?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The edge for lyrics search for cursor based pagination. */
  ['LyricsSearchEdge']: AliasType<{
    cursor?: boolean | `@${string}`;
    node?: ValueTypes['Track'];
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection for lyrics search for cursor based pagination. */
  ['LyricsSearchConnection']: AliasType<{
    pageInfo?: ValueTypes['PageInfo'];
    edges?: ValueTypes['LyricsSearchEdge'];
    __typename?: boolean | `@${string}`;
  }>;
  /** Describes the possible types that the 'lyricsSearch' field can return. */
  ['LyricsSearchResult']: AliasType<{
    ['...on LyricsSearchError']: ValueTypes['LyricsSearchError'];
    ['...on LyricsSearchConnection']: ValueTypes['LyricsSearchConnection'];
    __typename?: boolean | `@${string}`;
  }>;
};

export type ResolverInputTypes = {
  ['Error']: AliasType<{
    message?: boolean | `@${string}`;
    ['...on NoSimilarSpotifyTracksAvailableError']?: Omit<
      ResolverInputTypes['NoSimilarSpotifyTracksAvailableError'],
      keyof ResolverInputTypes['Error']
    >;
    ['...on SpotifySimilarLibraryTracksError']?: Omit<
      ResolverInputTypes['SpotifySimilarLibraryTracksError'],
      keyof ResolverInputTypes['Error']
    >;
    ['...on SpotifyTrackNotFoundError']?: Omit<
      ResolverInputTypes['SpotifyTrackNotFoundError'],
      keyof ResolverInputTypes['Error']
    >;
    ['...on SpotifyTrackWithoutPreviewUrlError']?: Omit<
      ResolverInputTypes['SpotifyTrackWithoutPreviewUrlError'],
      keyof ResolverInputTypes['Error']
    >;
    ['...on AudioAnalysisV6Error']?: Omit<
      ResolverInputTypes['AudioAnalysisV6Error'],
      keyof ResolverInputTypes['Error']
    >;
    ['...on LibraryTrackNotFoundError']?: Omit<
      ResolverInputTypes['LibraryTrackNotFoundError'],
      keyof ResolverInputTypes['Error']
    >;
    ['...on SimilarLibraryTracksError']?: Omit<
      ResolverInputTypes['SimilarLibraryTracksError'],
      keyof ResolverInputTypes['Error']
    >;
    ['...on CrateCreateError']?: Omit<
      ResolverInputTypes['CrateCreateError'],
      keyof ResolverInputTypes['Error']
    >;
    ['...on CrateDeleteError']?: Omit<
      ResolverInputTypes['CrateDeleteError'],
      keyof ResolverInputTypes['Error']
    >;
    ['...on CrateAddLibraryTracksError']?: Omit<
      ResolverInputTypes['CrateAddLibraryTracksError'],
      keyof ResolverInputTypes['Error']
    >;
    ['...on CrateRemoveLibraryTracksError']?: Omit<
      ResolverInputTypes['CrateRemoveLibraryTracksError'],
      keyof ResolverInputTypes['Error']
    >;
    ['...on LibraryTrackCreateError']?: Omit<
      ResolverInputTypes['LibraryTrackCreateError'],
      keyof ResolverInputTypes['Error']
    >;
    ['...on LibraryTrackEnqueueError']?: Omit<
      ResolverInputTypes['LibraryTrackEnqueueError'],
      keyof ResolverInputTypes['Error']
    >;
    ['...on LibraryTracksDeleteError']?: Omit<
      ResolverInputTypes['LibraryTracksDeleteError'],
      keyof ResolverInputTypes['Error']
    >;
    ['...on SpotifyTrackError']?: Omit<
      ResolverInputTypes['SpotifyTrackError'],
      keyof ResolverInputTypes['Error']
    >;
    ['...on SpotifyTrackEnqueueError']?: Omit<
      ResolverInputTypes['SpotifyTrackEnqueueError'],
      keyof ResolverInputTypes['Error']
    >;
    ['...on SimilarTracksError']?: Omit<
      ResolverInputTypes['SimilarTracksError'],
      keyof ResolverInputTypes['Error']
    >;
    ['...on KeywordSearchError']?: Omit<
      ResolverInputTypes['KeywordSearchError'],
      keyof ResolverInputTypes['Error']
    >;
    ['...on AugmentedKeywordsError']?: Omit<
      ResolverInputTypes['AugmentedKeywordsError'],
      keyof ResolverInputTypes['Error']
    >;
    ['...on BrandValuesError']?: Omit<
      ResolverInputTypes['BrandValuesError'],
      keyof ResolverInputTypes['Error']
    >;
    ['...on FreeTextSearchError']?: Omit<
      ResolverInputTypes['FreeTextSearchError'],
      keyof ResolverInputTypes['Error']
    >;
    ['...on LyricsSearchError']?: Omit<
      ResolverInputTypes['LyricsSearchError'],
      keyof ResolverInputTypes['Error']
    >;
    __typename?: boolean | `@${string}`;
  }>;
  /** Relay Style PageInfo (https://facebook.github.io/relay/graphql/connections.htm) */
  ['PageInfo']: AliasType<{
    hasNextPage?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['SpotifyArtistInfo']: AliasType<{
    id?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['SpotifyTrackInfo']: AliasType<{
    id?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    artists?: ResolverInputTypes['SpotifyArtistInfo'];
    __typename?: boolean | `@${string}`;
  }>;
  ['TrackAnalysisScores']: AliasType<{
    excited?: boolean | `@${string}`;
    euphoric?: boolean | `@${string}`;
    uplifting?: boolean | `@${string}`;
    angry?: boolean | `@${string}`;
    tense?: boolean | `@${string}`;
    melancholic?: boolean | `@${string}`;
    relaxed?: boolean | `@${string}`;
    happy?: boolean | `@${string}`;
    sad?: boolean | `@${string}`;
    dark?: boolean | `@${string}`;
    pumped?: boolean | `@${string}`;
    energetic?: boolean | `@${string}`;
    calm?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['TrackAnalysis']: AliasType<{
    arousal?: boolean | `@${string}`;
    valence?: boolean | `@${string}`;
    scores?: ResolverInputTypes['TrackAnalysisScores'];
    __typename?: boolean | `@${string}`;
  }>;
  ['AnalysisStatus']: AnalysisStatus;
  ['FileInfo']: AliasType<{
    duration?: boolean | `@${string}`;
    fileSizeKb?: boolean | `@${string}`;
    bitrate?: boolean | `@${string}`;
    sampleRate?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['TrackSegmentAnalysis']: AliasType<{
    start?: boolean | `@${string}`;
    /** the timestamp this segment belongs to */
    timestamp?: boolean | `@${string}`;
    duration?: boolean | `@${string}`;
    analysis?: ResolverInputTypes['TrackAnalysis'];
    __typename?: boolean | `@${string}`;
  }>;
  ['FileAnalysisLabel']: AliasType<{
    /** file analysis label title */
    title?: boolean | `@${string}`;
    /** identifier of the mood score this label represents */
    type?: boolean | `@${string}`;
    /** start of the interval */
    start?: boolean | `@${string}`;
    /** end of the interval */
    end?: boolean | `@${string}`;
    /** intensity of the mood score for the given interval */
    amount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['Mutation']: AliasType<{
    ping?: boolean | `@${string}`;
    /** Create a cyanite file upload request. */
    fileUploadRequest?: ResolverInputTypes['FileUploadRequest'];
    crateCreate?: [
      { input: ResolverInputTypes['CrateCreateInput'] },
      ResolverInputTypes['CrateCreateResult'],
    ];
    crateDelete?: [
      { input: ResolverInputTypes['CrateDeleteInput'] },
      ResolverInputTypes['CrateDeleteResult'],
    ];
    crateAddLibraryTracks?: [
      { input: ResolverInputTypes['CrateAddLibraryTracksInput'] },
      ResolverInputTypes['CrateAddLibraryTracksResult'],
    ];
    crateRemoveLibraryTracks?: [
      { input: ResolverInputTypes['CrateRemoveLibraryTracksInput'] },
      ResolverInputTypes['CrateRemoveLibraryTracksResult'],
    ];
    libraryTrackCreate?: [
      { input: ResolverInputTypes['LibraryTrackCreateInput'] },
      ResolverInputTypes['LibraryTrackCreateResult'],
    ];
    libraryTrackEnqueue?: [
      { input: ResolverInputTypes['LibraryTrackEnqueueInput'] },
      ResolverInputTypes['LibraryTrackEnqueueResult'],
    ];
    libraryTracksDelete?: [
      { input: ResolverInputTypes['LibraryTracksDeleteInput'] },
      ResolverInputTypes['LibraryTracksDeleteResult'],
    ];
    youTubeTrackEnqueue?: [
      { input: ResolverInputTypes['YouTubeTrackEnqueueInput'] },
      ResolverInputTypes['YouTubeTrackEnqueueResult'],
    ];
    spotifyTrackEnqueue?: [
      { input: ResolverInputTypes['SpotifyTrackEnqueueInput'] },
      ResolverInputTypes['SpotifyTrackEnqueueResult'],
    ];
    selectBrandValues?: [
      { input: ResolverInputTypes['SelectBrandValuesInput'] },
      ResolverInputTypes['SelectBrandValuesResult'],
    ];
    __typename?: boolean | `@${string}`;
  }>;
  ['Query']: AliasType<{
    ping?: boolean | `@${string}`;
    spotifyTrackAnalysis?: [
      {
        /** The id of the spotify track */ spotifyTrackId: string;
      },
      ResolverInputTypes['SpotifyTrackAnalysisResult'],
    ];
    libraryTrack?: [{ id: string }, ResolverInputTypes['LibraryTrackResult']];
    libraryTracks?: [
      {
        /** The amount of items that should be fetched. Default and maximum value is '50'. */
        first?:
          | number
          | undefined
          | null /** A cursor string after which items should be fetched. */;
        after?:
          | string
          | undefined
          | null /** Apply a filter on the library tracks. */;
        filter?: ResolverInputTypes['LibraryTracksFilter'] | undefined | null;
      },
      ResolverInputTypes['LibraryTrackConnection'],
    ];
    crates?: [
      {
        /** The number of items that should be fetched. Default and maximum value is '10'. */
        first?:
          | number
          | undefined
          | null /** A cursor string after which items should be fetched. */;
        after?: string | undefined | null;
      },
      ResolverInputTypes['CratesConnection'],
    ];
    spotifyTrack?: [{ id: string }, ResolverInputTypes['SpotifyTrackResult']];
    keywordSearch?: [
      {
        /** Amount of items to fetch. */
        first?:
          | number
          | undefined
          | null /** What kind of results should be returned? Either Spotify or Library tracks. */;
        target: ResolverInputTypes['KeywordSearchTarget'] /** The keywords that will be used for searching tracks. */;
        keywords: Array<ResolverInputTypes['KeywordSearchKeyword']>;
      },
      ResolverInputTypes['KeywordSearchResult'],
    ];
    /** Search for keywords that can be used for the keyword search. */
    keywords?: ResolverInputTypes['KeywordConnection'];
    /** Get a list of all available brand values */
    brandValues?: ResolverInputTypes['BrandValuesResult'];
    freeTextSearch?: [
      {
        searchText: string;
        target: ResolverInputTypes['FreeTextSearchTarget'];
        first?: number | undefined | null;
      },
      ResolverInputTypes['FreeTextSearchResult'],
    ];
    lyricsSearch?: [
      {
        prompt: string;
        target: ResolverInputTypes['LyricsSearchTarget'];
        first?: number | undefined | null;
      },
      ResolverInputTypes['LyricsSearchResult'],
    ];
    __typename?: boolean | `@${string}`;
  }>;
  ['Subscription']: AliasType<{
    ping?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['InDepthAnalysisGenre']: AliasType<{
    title?: boolean | `@${string}`;
    confidence?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** This type is deprecated and will be removed in the future. */
  ['NoSimilarSpotifyTracksAvailableError']: AliasType<{
    message?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** This union type is deprecated and will be removed in the future. */
  ['SimilarSpotifyTracksResult']: AliasType<{
    NoSimilarSpotifyTracksAvailableError?: ResolverInputTypes['NoSimilarSpotifyTracksAvailableError'];
    SimilarSpotifyTrackConnection?: ResolverInputTypes['SimilarSpotifyTrackConnection'];
    __typename?: boolean | `@${string}`;
  }>;
  ['SimilarLibraryTrackNode']: AliasType<{
    distance?: boolean | `@${string}`;
    sort?: boolean | `@${string}`;
    inDepthAnalysisId?: boolean | `@${string}`;
    libraryTrack?: ResolverInputTypes['LibraryTrack'];
    __typename?: boolean | `@${string}`;
  }>;
  ['SimilarLibraryTrackEdge']: AliasType<{
    cursor?: boolean | `@${string}`;
    node?: ResolverInputTypes['SimilarLibraryTrackNode'];
    __typename?: boolean | `@${string}`;
  }>;
  ['SimilarLibraryTrackConnection']: AliasType<{
    pageInfo?: ResolverInputTypes['PageInfo'];
    edges?: ResolverInputTypes['SimilarLibraryTrackEdge'];
    __typename?: boolean | `@${string}`;
  }>;
  ['SimilaritySearchWeightFilter']: {
    genre?: number | undefined | null;
    mood?: number | undefined | null;
    voice?: number | undefined | null;
    mfccs?: number | undefined | null;
  };
  ['EnergyLevel']: EnergyLevel;
  ['EnergyDynamics']: EnergyDynamics;
  ['EmotionalProfile']: EmotionalProfile;
  ['EmotionalDynamics']: EmotionalDynamics;
  ['VoicePresenceProfile']: VoicePresenceProfile;
  ['PredominantVoiceGender']: PredominantVoiceGender;
  /** Describes the voice classifier results over time, mapped to the index of the timestamps. */
  ['VoiceSegmentScores']: AliasType<{
    /** Scores for female voice, mapped to the index of the timestamp. */
    female?: boolean | `@${string}`;
    /** Scores for instrumental, mapped to the index of the timestamp. */
    instrumental?: boolean | `@${string}`;
    /** Scores for male voice, mapped to the index of the timestamp. */
    male?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Describes the mean scores of the voice classifier result. */
  ['VoiceMeanScores']: AliasType<{
    /** Mean female score. */
    female?: boolean | `@${string}`;
    /** Mean instrumental score. */
    instrumental?: boolean | `@${string}`;
    /** Mean instrumental male score. */
    male?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['FileUploadRequest']: AliasType<{
    id?: boolean | `@${string}`;
    uploadUrl?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['InDepthAnalysisCreateInput']: {
    fileName: string;
    uploadId: string;
    organizationId?: string | undefined | null;
    externalId?: string | undefined | null;
    /** The associated file tag name. It can later on be used for filtering. */
    tags?: Array<string> | undefined | null;
    /** Whether the file should be enqueued automatically */
    enqueue?: boolean | undefined | null;
  };
  /** This type is deprecated and will be removed in the future. */
  ['SimilarSpotifyTrackNode']: AliasType<{
    distance?: boolean | `@${string}`;
    score?: boolean | `@${string}`;
    spotifyTrackId?: boolean | `@${string}`;
    trackInfo?: ResolverInputTypes['SpotifyTrackInfo'];
    __typename?: boolean | `@${string}`;
  }>;
  /** This type is deprecated and will be removed in the future */
  ['SimilarSpotifyTrackEdge']: AliasType<{
    cursor?: boolean | `@${string}`;
    node?: ResolverInputTypes['SimilarSpotifyTrackNode'];
    __typename?: boolean | `@${string}`;
  }>;
  /** This type is deprecated and will be removed in the future */
  ['SimilarSpotifyTrackConnection']: AliasType<{
    pageInfo?: ResolverInputTypes['PageInfo'];
    edges?: ResolverInputTypes['SimilarSpotifyTrackEdge'];
    __typename?: boolean | `@${string}`;
  }>;
  /** spotify analysis related stuff */
  ['SpotifyTrackAnalysis']: AliasType<{
    id?: boolean | `@${string}`;
    status?: boolean | `@${string}`;
    similarLibraryTracks?: [
      {
        weights?:
          | ResolverInputTypes['SimilaritySearchWeightFilter']
          | undefined
          | null;
      },
      ResolverInputTypes['SpotifySimilarLibraryTracks'],
    ];
    __typename?: boolean | `@${string}`;
  }>;
  /** This type is deprecated and will be removed in the future. */
  ['SpotifySimilarLibraryTracks']: AliasType<{
    SpotifySimilarLibraryTracksResult?: ResolverInputTypes['SpotifySimilarLibraryTracksResult'];
    SpotifySimilarLibraryTracksError?: ResolverInputTypes['SpotifySimilarLibraryTracksError'];
    __typename?: boolean | `@${string}`;
  }>;
  /** This type is deprecated and will be removed in the future. */
  ['SpotifySimilarLibraryTracksResult']: AliasType<{
    results?: ResolverInputTypes['LibraryTrack'];
    __typename?: boolean | `@${string}`;
  }>;
  /** This type is deprecated and will be removed in the future. */
  ['SpotifySimilarLibraryTracksError']: AliasType<{
    code?: boolean | `@${string}`;
    message?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['SpotifyTrackNotFoundError']: AliasType<{
    message?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['SpotifyTrackWithoutPreviewUrlError']: AliasType<{
    message?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['SpotifyTrackAnalysisResult']: AliasType<{
    SpotifyTrackAnalysis?: ResolverInputTypes['SpotifyTrackAnalysis'];
    SpotifyTrackNotFoundError?: ResolverInputTypes['SpotifyTrackNotFoundError'];
    SpotifyTrackWithoutPreviewUrlError?: ResolverInputTypes['SpotifyTrackWithoutPreviewUrlError'];
    __typename?: boolean | `@${string}`;
  }>;
  ['Track']: AliasType<{
    id?: boolean | `@${string}`;
    title?: boolean | `@${string}`;
    audioAnalysisV6?: ResolverInputTypes['AudioAnalysisV6'];
    similarTracks?: [
      {
        /** Amount of items to fetch. */
        first?:
          | number
          | undefined
          | null /** The relevant parts of the track that should be used for the similarity search. */;
        searchMode?:
          | ResolverInputTypes['SimilarTracksSearchMode']
          | undefined
          | null /** What kind of results should be returned? Either Spotify or Library tracks. */;
        target: ResolverInputTypes['SimilarTracksTarget'] /** Filters to apply on to the similarity search. */;
        experimental_filter?:
          | ResolverInputTypes['experimental_SimilarTracksFilter']
          | undefined
          | null;
      },
      ResolverInputTypes['SimilarTracksResult'],
    ];
    /** Augmented keywords that can be associated with the audio. */
    augmentedKeywords?: ResolverInputTypes['AugmentedKeywordsResult'];
    /** Brand values that can be associated with the audio. */
    brandValues?: ResolverInputTypes['BrandValuesResult'];
    ['...on LibraryTrack']?: Omit<
      ResolverInputTypes['LibraryTrack'],
      keyof ResolverInputTypes['Track']
    >;
    ['...on SpotifyTrack']?: Omit<
      ResolverInputTypes['SpotifyTrack'],
      keyof ResolverInputTypes['Track']
    >;
    __typename?: boolean | `@${string}`;
  }>;
  /** Possible results of querying Audio Analysis V6. */
  ['AudioAnalysisV6']: AliasType<{
    AudioAnalysisV6NotStarted?: ResolverInputTypes['AudioAnalysisV6NotStarted'];
    AudioAnalysisV6Enqueued?: ResolverInputTypes['AudioAnalysisV6Enqueued'];
    AudioAnalysisV6Processing?: ResolverInputTypes['AudioAnalysisV6Processing'];
    AudioAnalysisV6Finished?: ResolverInputTypes['AudioAnalysisV6Finished'];
    AudioAnalysisV6Failed?: ResolverInputTypes['AudioAnalysisV6Failed'];
    __typename?: boolean | `@${string}`;
  }>;
  /** Audio Analysis V6 hasn't been started for this track yet. */
  ['AudioAnalysisV6NotStarted']: AliasType<{
    _?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Audio Analysis V6 is enqueued and will be processed soon. */
  ['AudioAnalysisV6Enqueued']: AliasType<{
    _?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Audio Analysis V6 is being processed. */
  ['AudioAnalysisV6Processing']: AliasType<{
    _?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Audio Analysis V6 is completed and the results can be retrieved. */
  ['AudioAnalysisV6Finished']: AliasType<{
    result?: ResolverInputTypes['AudioAnalysisV6Result'];
    __typename?: boolean | `@${string}`;
  }>;
  /** Audio Analysis V6 failed. */
  ['AudioAnalysisV6Failed']: AliasType<{
    /** More detailed information on why the analysis has failed. */
    error?: ResolverInputTypes['AudioAnalysisV6Error'];
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6Error']: AliasType<{
    message?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Describes all possible genre tags. */
  ['AudioAnalysisV6GenreTags']: AudioAnalysisV6GenreTags;
  /** Describes all possible EDM subgenre tags. */
  ['AudioAnalysisV6SubgenreEdmTags']: AudioAnalysisV6SubgenreEdmTags;
  /** Describes all possible mood tags. */
  ['AudioAnalysisV6MoodTags']: AudioAnalysisV6MoodTags;
  /** Describes a track segment where the particular mood is most prominent. */
  ['AudioAnalysisV6MaximumMoodInterval']: AliasType<{
    mood?: boolean | `@${string}`;
    /** Start of the segment in seconds. */
    start?: boolean | `@${string}`;
    /** End of the segment in seconds. */
    end?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6Genre']: AliasType<{
    /** Mean prediction value for the "ambient" genre. */
    ambient?: boolean | `@${string}`;
    /** Mean prediction value for the "blues" genre. */
    blues?: boolean | `@${string}`;
    /** Mean prediction value for the "classical" genre. */
    classical?: boolean | `@${string}`;
    /** Mean prediction value for the "country" genre. */
    country?: boolean | `@${string}`;
    /** Mean prediction value for the "electronicDance" genre. */
    electronicDance?: boolean | `@${string}`;
    /** Mean prediction value for the "folk" genre. */
    folk?: boolean | `@${string}`;
    /** Mean prediction value for the "folkCountry" genre. */
    folkCountry?: boolean | `@${string}`;
    /** Mean prediction value for the "indieAlternative" genre. */
    indieAlternative?: boolean | `@${string}`;
    /** Mean prediction value for the "funkSoul" genre. */
    funkSoul?: boolean | `@${string}`;
    /** Mean prediction value for the "jazz" genre. */
    jazz?: boolean | `@${string}`;
    /** Mean prediction value for the "latin" genre. */
    latin?: boolean | `@${string}`;
    /** Mean prediction value for the "metal" genre. */
    metal?: boolean | `@${string}`;
    /** Mean prediction value for the "pop" genre. */
    pop?: boolean | `@${string}`;
    /** Mean prediction value for the "punk" genre. */
    punk?: boolean | `@${string}`;
    /** Mean prediction value for the "rapHipHop" genre. */
    rapHipHop?: boolean | `@${string}`;
    /** Mean prediction value for the "reggae" genre. */
    reggae?: boolean | `@${string}`;
    /** Mean prediction value for the "rnb" genre. */
    rnb?: boolean | `@${string}`;
    /** Mean prediction value for the "rock" genre. */
    rock?: boolean | `@${string}`;
    /** Mean prediction value for the "singerSongwriter" genre. */
    singerSongwriter?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6GenreSegments']: AliasType<{
    /** Segments prediction value for the "ambient" genre. */
    ambient?: boolean | `@${string}`;
    /** Segments prediction value for the "blues" genre. */
    blues?: boolean | `@${string}`;
    /** Segments prediction value for the "classical" genre. */
    classical?: boolean | `@${string}`;
    /** Segments prediction value for the "country" genre. */
    country?: boolean | `@${string}`;
    /** Segments prediction value for the "electronicDance" genre. */
    electronicDance?: boolean | `@${string}`;
    /** Segments prediction value for the "folk" genre. */
    folk?: boolean | `@${string}`;
    /** Segments prediction value for the "folkCountry" genre. */
    folkCountry?: boolean | `@${string}`;
    /** Segments prediction value for the "indieAlternative" genre. */
    indieAlternative?: boolean | `@${string}`;
    /** Segments prediction value for the "funkSoul" genre. */
    funkSoul?: boolean | `@${string}`;
    /** Segments prediction value for the "jazz" genre. */
    jazz?: boolean | `@${string}`;
    /** Segments prediction value for the "latin" genre. */
    latin?: boolean | `@${string}`;
    /** Segments prediction value for the "metal" genre. */
    metal?: boolean | `@${string}`;
    /** Segments prediction value for the "pop" genre. */
    pop?: boolean | `@${string}`;
    /** Segments prediction value for the "punk" genre. */
    punk?: boolean | `@${string}`;
    /** Segments prediction value for the "rapHipHop" genre. */
    rapHipHop?: boolean | `@${string}`;
    /** Segments prediction value for the "reggae" genre. */
    reggae?: boolean | `@${string}`;
    /** Segments prediction value for the "rnb" genre. */
    rnb?: boolean | `@${string}`;
    /** Segments prediction value for the "rock" genre. */
    rock?: boolean | `@${string}`;
    /** Segments prediction value for the "singerSongwriter" genre. */
    singerSongwriter?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6SubgenreSegments']: AliasType<{
    /** Segments prediction value for the "bluesRock" sub-genre. */
    bluesRock?: boolean | `@${string}`;
    /** Segments prediction value for the "folkRock" sub-genre. */
    folkRock?: boolean | `@${string}`;
    /** Segments prediction value for the "hardRock" sub-genre. */
    hardRock?: boolean | `@${string}`;
    /** Segments prediction value for the "indieAlternative" sub-genre. */
    indieAlternative?: boolean | `@${string}`;
    /** Segments prediction value for the "psychedelicProgressiveRock" sub-genre. */
    psychedelicProgressiveRock?: boolean | `@${string}`;
    /** Segments prediction value for the "punk" sub-genre. */
    punk?: boolean | `@${string}`;
    /** Segments prediction value for the "rockAndRoll" sub-genre. */
    rockAndRoll?: boolean | `@${string}`;
    /** Segments prediction value for the "popSoftRock" sub-genre. */
    popSoftRock?: boolean | `@${string}`;
    /** Segments prediction value for the "abstractIDMLeftfield" sub-genre. */
    abstractIDMLeftfield?: boolean | `@${string}`;
    /** Segments prediction value for the "breakbeatDnB" sub-genre. */
    breakbeatDnB?: boolean | `@${string}`;
    /** Segments prediction value for the "deepHouse" sub-genre. */
    deepHouse?: boolean | `@${string}`;
    /** Segments prediction value for the "electro" sub-genre. */
    electro?: boolean | `@${string}`;
    /** Segments prediction value for the "house" sub-genre. */
    house?: boolean | `@${string}`;
    /** Segments prediction value for the "minimal" sub-genre. */
    minimal?: boolean | `@${string}`;
    /** Segments prediction value for the "synthPop" sub-genre. */
    synthPop?: boolean | `@${string}`;
    /** Segments prediction value for the "techHouse" sub-genre. */
    techHouse?: boolean | `@${string}`;
    /** Segments prediction value for the "techno" sub-genre. */
    techno?: boolean | `@${string}`;
    /** Segments prediction value for the "trance" sub-genre. */
    trance?: boolean | `@${string}`;
    /** Segments prediction value for the "contemporaryRnB" sub-genre. */
    contemporaryRnB?: boolean | `@${string}`;
    /** Segments prediction value for the "gangsta" sub-genre. */
    gangsta?: boolean | `@${string}`;
    /** Segments prediction value for the "jazzyHipHop" sub-genre. */
    jazzyHipHop?: boolean | `@${string}`;
    /** Segments prediction value for the "popRap" sub-genre. */
    popRap?: boolean | `@${string}`;
    /** Segments prediction value for the "trap" sub-genre. */
    trap?: boolean | `@${string}`;
    /** Segments prediction value for the "blackMetal" sub-genre. */
    blackMetal?: boolean | `@${string}`;
    /** Segments prediction value for the "deathMetal" sub-genre. */
    deathMetal?: boolean | `@${string}`;
    /** Segments prediction value for the "doomMetal" sub-genre. */
    doomMetal?: boolean | `@${string}`;
    /** Segments prediction value for the "heavyMetal" sub-genre. */
    heavyMetal?: boolean | `@${string}`;
    /** Segments prediction value for the "metalcore" sub-genre. */
    metalcore?: boolean | `@${string}`;
    /** Segments prediction value for the "nuMetal" sub-genre. */
    nuMetal?: boolean | `@${string}`;
    /** Segments prediction value for the "disco" sub-genre. */
    disco?: boolean | `@${string}`;
    /** Segments prediction value for the "funk" sub-genre. */
    funk?: boolean | `@${string}`;
    /** Segments prediction value for the "gospel" sub-genre. */
    gospel?: boolean | `@${string}`;
    /** Segments prediction value for the "neoSoul" sub-genre. */
    neoSoul?: boolean | `@${string}`;
    /** Segments prediction value for the "soul" sub-genre. */
    soul?: boolean | `@${string}`;
    /** Segments prediction value for the "bigBandSwing" sub-genre. */
    bigBandSwing?: boolean | `@${string}`;
    /** Segments prediction value for the "bebop" sub-genre. */
    bebop?: boolean | `@${string}`;
    /** Segments prediction value for the "contemporaryJazz" sub-genre. */
    contemporaryJazz?: boolean | `@${string}`;
    /** Segments prediction value for the "easyListening" sub-genre. */
    easyListening?: boolean | `@${string}`;
    /** Segments prediction value for the "fusion" sub-genre. */
    fusion?: boolean | `@${string}`;
    /** Segments prediction value for the "latinJazz" sub-genre. */
    latinJazz?: boolean | `@${string}`;
    /** Segments prediction value for the "smoothJazz" sub-genre. */
    smoothJazz?: boolean | `@${string}`;
    /** Segments prediction value for the "country" sub-genre. */
    country?: boolean | `@${string}`;
    /** Segments prediction value for the "folk" sub-genre. */
    folk?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** This type is fully deprecated all the subgenre EDM values moved to the AudioAnalysisV6Subgenre type. */
  ['AudioAnalysisV6SubgenreEdm']: AliasType<{
    /** Mean prediction value for the "breakbeatDrumAndBass" EDM subgenre. */
    breakbeatDrumAndBass?: boolean | `@${string}`;
    /** Mean prediction value for the "deepHouse" EDM subgenre. */
    deepHouse?: boolean | `@${string}`;
    /** Mean prediction value for the "electro" EDM subgenre. */
    electro?: boolean | `@${string}`;
    /** Mean prediction value for the "house" EDM subgenre. */
    house?: boolean | `@${string}`;
    /** Mean prediction value for the "minimal" EDM subgenre. */
    minimal?: boolean | `@${string}`;
    /** Mean prediction value for the "techHouse" EDM subgenre. */
    techHouse?: boolean | `@${string}`;
    /** Mean prediction value for the "techno" EDM subgenre. */
    techno?: boolean | `@${string}`;
    /** Mean prediction value for the "trance" EDM subgenre. */
    trance?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6SubgenreTags']: AudioAnalysisV6SubgenreTags;
  ['AudioAnalysisV6Subgenre']: AliasType<{
    /** Mean prediction value for the "bluesRock" sub-genre. */
    bluesRock?: boolean | `@${string}`;
    /** Mean prediction value for the "folkRock" sub-genre. */
    folkRock?: boolean | `@${string}`;
    /** Mean prediction value for the "hardRock" sub-genre. */
    hardRock?: boolean | `@${string}`;
    /** Mean prediction value for the "indieAlternative" sub-genre. */
    indieAlternative?: boolean | `@${string}`;
    /** Mean prediction value for the "psychedelicProgressiveRock" sub-genre. */
    psychedelicProgressiveRock?: boolean | `@${string}`;
    /** Mean prediction value for the "punk" sub-genre. */
    punk?: boolean | `@${string}`;
    /** Mean prediction value for the "rockAndRoll" sub-genre. */
    rockAndRoll?: boolean | `@${string}`;
    /** Mean prediction value for the "popSoftRock" sub-genre. */
    popSoftRock?: boolean | `@${string}`;
    /** Mean prediction value for the "abstractIDMLeftfield" sub-genre. */
    abstractIDMLeftfield?: boolean | `@${string}`;
    /** Mean prediction value for the "breakbeatDnB" sub-genre. */
    breakbeatDnB?: boolean | `@${string}`;
    /** Mean prediction value for the "deepHouse" sub-genre. */
    deepHouse?: boolean | `@${string}`;
    /** Mean prediction value for the "electro" sub-genre. */
    electro?: boolean | `@${string}`;
    /** Mean prediction value for the "house" sub-genre. */
    house?: boolean | `@${string}`;
    /** Mean prediction value for the "minimal" sub-genre. */
    minimal?: boolean | `@${string}`;
    /** Mean prediction value for the "synthPop" sub-genre. */
    synthPop?: boolean | `@${string}`;
    /** Mean prediction value for the "techHouse" sub-genre. */
    techHouse?: boolean | `@${string}`;
    /** Mean prediction value for the "techno" sub-genre. */
    techno?: boolean | `@${string}`;
    /** Mean prediction value for the "trance" sub-genre. */
    trance?: boolean | `@${string}`;
    /** Mean prediction value for the "contemporaryRnB" sub-genre. */
    contemporaryRnB?: boolean | `@${string}`;
    /** Mean prediction value for the "gangsta" sub-genre. */
    gangsta?: boolean | `@${string}`;
    /** Mean prediction value for the "jazzyHipHop" sub-genre. */
    jazzyHipHop?: boolean | `@${string}`;
    /** Mean prediction value for the "popRap" sub-genre. */
    popRap?: boolean | `@${string}`;
    /** Mean prediction value for the "trap" sub-genre. */
    trap?: boolean | `@${string}`;
    /** Mean prediction value for the "blackMetal" sub-genre. */
    blackMetal?: boolean | `@${string}`;
    /** Mean prediction value for the "deathMetal" sub-genre. */
    deathMetal?: boolean | `@${string}`;
    /** Mean prediction value for the "doomMetal" sub-genre. */
    doomMetal?: boolean | `@${string}`;
    /** Mean prediction value for the "heavyMetal" sub-genre. */
    heavyMetal?: boolean | `@${string}`;
    /** Mean prediction value for the "metalcore" sub-genre. */
    metalcore?: boolean | `@${string}`;
    /** Mean prediction value for the "nuMetal" sub-genre. */
    nuMetal?: boolean | `@${string}`;
    /** Mean prediction value for the "disco" sub-genre. */
    disco?: boolean | `@${string}`;
    /** Mean prediction value for the "funk" sub-genre. */
    funk?: boolean | `@${string}`;
    /** Mean prediction value for the "gospel" sub-genre. */
    gospel?: boolean | `@${string}`;
    /** Mean prediction value for the "neoSoul" sub-genre. */
    neoSoul?: boolean | `@${string}`;
    /** Mean prediction value for the "soul" sub-genre. */
    soul?: boolean | `@${string}`;
    /** Mean prediction value for the "bigBandSwing" sub-genre. */
    bigBandSwing?: boolean | `@${string}`;
    /** Mean prediction value for the "bebop" sub-genre. */
    bebop?: boolean | `@${string}`;
    /** Mean prediction value for the "contemporaryJazz" sub-genre. */
    contemporaryJazz?: boolean | `@${string}`;
    /** Mean prediction value for the "easyListening" sub-genre. */
    easyListening?: boolean | `@${string}`;
    /** Mean prediction value for the "fusion" sub-genre. */
    fusion?: boolean | `@${string}`;
    /** Mean prediction value for the "latinJazz" sub-genre. */
    latinJazz?: boolean | `@${string}`;
    /** Mean prediction value for the "smoothJazz" sub-genre. */
    smoothJazz?: boolean | `@${string}`;
    /** Mean prediction value for the "country" sub-genre. */
    country?: boolean | `@${string}`;
    /** Mean prediction value for the "folk" sub-genre. */
    folk?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6Mood']: AliasType<{
    /** Mean prediction value for the "aggressive" mood. */
    aggressive?: boolean | `@${string}`;
    /** Mean prediction value for the "calm" mood. */
    calm?: boolean | `@${string}`;
    /** Mean prediction value for the "chilled" mood. */
    chilled?: boolean | `@${string}`;
    /** Mean prediction value for the "dark" mood. */
    dark?: boolean | `@${string}`;
    /** Mean prediction value for the "energetic" mood. */
    energetic?: boolean | `@${string}`;
    /** Mean prediction value for the "epic" mood. */
    epic?: boolean | `@${string}`;
    /** Mean prediction value for the "happy" mood. */
    happy?: boolean | `@${string}`;
    /** Mean prediction value for the "romantic" mood. */
    romantic?: boolean | `@${string}`;
    /** Mean prediction value for the "sad" mood. */
    sad?: boolean | `@${string}`;
    /** Mean prediction value for the "scary" mood. */
    scary?: boolean | `@${string}`;
    /** Mean prediction value for the "sexy" mood. */
    sexy?: boolean | `@${string}`;
    /** Mean prediction value for the "ethereal" mood. */
    ethereal?: boolean | `@${string}`;
    /** Mean prediction value for the "uplifting" mood. */
    uplifting?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6MoodSegments']: AliasType<{
    /** Segments prediction value for the "aggressive" mood. */
    aggressive?: boolean | `@${string}`;
    /** Segments prediction value for the "calm" mood. */
    calm?: boolean | `@${string}`;
    /** Segments prediction value for the "chilled" mood. */
    chilled?: boolean | `@${string}`;
    /** Segments prediction value for the "dark" mood. */
    dark?: boolean | `@${string}`;
    /** Segments prediction value for the "energetic" mood. */
    energetic?: boolean | `@${string}`;
    /** Segments prediction value for the "epic" mood. */
    epic?: boolean | `@${string}`;
    /** Segments prediction value for the "happy" mood. */
    happy?: boolean | `@${string}`;
    /** Segments prediction value for the "romantic" mood. */
    romantic?: boolean | `@${string}`;
    /** Segments prediction value for the "sad" mood. */
    sad?: boolean | `@${string}`;
    /** Segments prediction value for the "scary" mood. */
    scary?: boolean | `@${string}`;
    /** Segments prediction value for the "sexy" mood. */
    sexy?: boolean | `@${string}`;
    /** Segments prediction value for the "ethereal" mood. */
    ethereal?: boolean | `@${string}`;
    /** Segments prediction value for the "uplifting" mood. */
    uplifting?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6Instruments']: AliasType<{
    /** Mean prediction value for the "percussion" instrument presence. */
    percussion?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Instruments detected by the instrument recognition. */
  ['AudioAnalysisV6InstrumentTags']: AudioAnalysisV6InstrumentTags;
  /** The intensity of an instrument's presence throughout a track. */
  ['AudioAnalysisInstrumentPresenceLabel']: AudioAnalysisInstrumentPresenceLabel;
  /** The intensity of an instrument's presence throughout a track. */
  ['AudioAnalysisV6InstrumentPresence']: AliasType<{
    /** Intensity of the percussion instrument. */
    percussion?: boolean | `@${string}`;
    /** Intensity of the synthesizer instrument. */
    synth?: boolean | `@${string}`;
    /** Intensity of the piano instrument. */
    piano?: boolean | `@${string}`;
    /** Intensity of the acoustic guitar instrument. */
    acousticGuitar?: boolean | `@${string}`;
    /** Intensity of the electric guitar instrument. */
    electricGuitar?: boolean | `@${string}`;
    /** Intensity of the strings instrument. */
    strings?: boolean | `@${string}`;
    /** Intensity of the bass instrument. */
    bass?: boolean | `@${string}`;
    /** Intensity of the bass guitar instrument. */
    bassGuitar?: boolean | `@${string}`;
    /** Intensity of the brass/woodwinds instrument. */
    brassWoodwinds?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6InstrumentsSegments']: AliasType<{
    /** Segments prediction value for the "percussion" instrument presence. */
    percussion?: boolean | `@${string}`;
    /** Segments prediction value for the "synth" instrument presence. */
    synth?: boolean | `@${string}`;
    /** Segments prediction value for the "piano" instrument presence. */
    piano?: boolean | `@${string}`;
    /** Segments prediction value for the "acousticGuitar" instrument presence. */
    acousticGuitar?: boolean | `@${string}`;
    /** Segments prediction value for the "electricGuitar" instrument presence. */
    electricGuitar?: boolean | `@${string}`;
    /** Segments prediction value for the "strings" instrument presence. */
    strings?: boolean | `@${string}`;
    /** Segments prediction value for the "bass" instrument presence. */
    bass?: boolean | `@${string}`;
    /** Segments prediction value for the "bassGuitar" instrument presence. */
    bassGuitar?: boolean | `@${string}`;
    /** Segments prediction value for the "brassWoodwinds" instrument presence. */
    brassWoodwinds?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6Voice']: AliasType<{
    /** Mean prediction value for the "female" voice type. */
    female?: boolean | `@${string}`;
    /** Mean prediction value for the "instrumental" voice type. */
    instrumental?: boolean | `@${string}`;
    /** Mean prediction value for the "male" voice type. */
    male?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6VoiceSegments']: AliasType<{
    /** Segments prediction value for the "female" voice type. */
    female?: boolean | `@${string}`;
    /** Segments prediction value for the "instrumental" voice type. */
    instrumental?: boolean | `@${string}`;
    /** Segments prediction value for the "male" voice type. */
    male?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6SubgenreEdmSegments']: AliasType<{
    /** Segments prediction value for the "breakbeatDrumAndBass" EDM subgenre. */
    breakbeatDrumAndBass?: boolean | `@${string}`;
    /** Segments prediction value for the "deepHouse" EDM subgenre. */
    deepHouse?: boolean | `@${string}`;
    /** Segments prediction value for the "electro" EDM subgenre. */
    electro?: boolean | `@${string}`;
    /** Segments prediction value for the "house" EDM subgenre. */
    house?: boolean | `@${string}`;
    /** Segments prediction value for the "minimal" EDM subgenre. */
    minimal?: boolean | `@${string}`;
    /** Segments prediction value for the "techHouse" EDM subgenre. */
    techHouse?: boolean | `@${string}`;
    /** Segments prediction value for the "techno" EDM subgenre. */
    techno?: boolean | `@${string}`;
    /** Segments prediction value for the "trance" EDM subgenre. */
    trance?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6Movement']: AliasType<{
    bouncy?: boolean | `@${string}`;
    driving?: boolean | `@${string}`;
    flowing?: boolean | `@${string}`;
    groovy?: boolean | `@${string}`;
    nonrhythmic?: boolean | `@${string}`;
    pulsing?: boolean | `@${string}`;
    robotic?: boolean | `@${string}`;
    running?: boolean | `@${string}`;
    steady?: boolean | `@${string}`;
    stomping?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6MovementSegments']: AliasType<{
    bouncy?: boolean | `@${string}`;
    driving?: boolean | `@${string}`;
    flowing?: boolean | `@${string}`;
    groovy?: boolean | `@${string}`;
    nonrhythmic?: boolean | `@${string}`;
    pulsing?: boolean | `@${string}`;
    robotic?: boolean | `@${string}`;
    running?: boolean | `@${string}`;
    steady?: boolean | `@${string}`;
    stomping?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6Character']: AliasType<{
    bold?: boolean | `@${string}`;
    cool?: boolean | `@${string}`;
    epic?: boolean | `@${string}`;
    ethereal?: boolean | `@${string}`;
    heroic?: boolean | `@${string}`;
    luxurious?: boolean | `@${string}`;
    magical?: boolean | `@${string}`;
    mysterious?: boolean | `@${string}`;
    playful?: boolean | `@${string}`;
    powerful?: boolean | `@${string}`;
    retro?: boolean | `@${string}`;
    sophisticated?: boolean | `@${string}`;
    sparkling?: boolean | `@${string}`;
    sparse?: boolean | `@${string}`;
    unpolished?: boolean | `@${string}`;
    warm?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6CharacterSegments']: AliasType<{
    bold?: boolean | `@${string}`;
    cool?: boolean | `@${string}`;
    epic?: boolean | `@${string}`;
    ethereal?: boolean | `@${string}`;
    heroic?: boolean | `@${string}`;
    luxurious?: boolean | `@${string}`;
    magical?: boolean | `@${string}`;
    mysterious?: boolean | `@${string}`;
    playful?: boolean | `@${string}`;
    powerful?: boolean | `@${string}`;
    retro?: boolean | `@${string}`;
    sophisticated?: boolean | `@${string}`;
    sparkling?: boolean | `@${string}`;
    sparse?: boolean | `@${string}`;
    unpolished?: boolean | `@${string}`;
    warm?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6ClassicalEpoch']: AliasType<{
    middleAge?: boolean | `@${string}`;
    renaissance?: boolean | `@${string}`;
    baroque?: boolean | `@${string}`;
    classical?: boolean | `@${string}`;
    romantic?: boolean | `@${string}`;
    contemporary?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6ClassicalEpochSegments']: AliasType<{
    middleAge?: boolean | `@${string}`;
    renaissance?: boolean | `@${string}`;
    baroque?: boolean | `@${string}`;
    classical?: boolean | `@${string}`;
    romantic?: boolean | `@${string}`;
    contemporary?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6MoodAdvanced']: AliasType<{
    anxious?: boolean | `@${string}`;
    barren?: boolean | `@${string}`;
    cold?: boolean | `@${string}`;
    creepy?: boolean | `@${string}`;
    dark?: boolean | `@${string}`;
    disturbing?: boolean | `@${string}`;
    eerie?: boolean | `@${string}`;
    evil?: boolean | `@${string}`;
    fearful?: boolean | `@${string}`;
    mysterious?: boolean | `@${string}`;
    nervous?: boolean | `@${string}`;
    restless?: boolean | `@${string}`;
    spooky?: boolean | `@${string}`;
    strange?: boolean | `@${string}`;
    supernatural?: boolean | `@${string}`;
    suspenseful?: boolean | `@${string}`;
    tense?: boolean | `@${string}`;
    weird?: boolean | `@${string}`;
    aggressive?: boolean | `@${string}`;
    agitated?: boolean | `@${string}`;
    angry?: boolean | `@${string}`;
    dangerous?: boolean | `@${string}`;
    fiery?: boolean | `@${string}`;
    intense?: boolean | `@${string}`;
    passionate?: boolean | `@${string}`;
    ponderous?: boolean | `@${string}`;
    violent?: boolean | `@${string}`;
    comedic?: boolean | `@${string}`;
    eccentric?: boolean | `@${string}`;
    funny?: boolean | `@${string}`;
    mischievous?: boolean | `@${string}`;
    quirky?: boolean | `@${string}`;
    whimsical?: boolean | `@${string}`;
    boisterous?: boolean | `@${string}`;
    boingy?: boolean | `@${string}`;
    bright?: boolean | `@${string}`;
    celebratory?: boolean | `@${string}`;
    cheerful?: boolean | `@${string}`;
    excited?: boolean | `@${string}`;
    feelGood?: boolean | `@${string}`;
    fun?: boolean | `@${string}`;
    happy?: boolean | `@${string}`;
    joyous?: boolean | `@${string}`;
    lighthearted?: boolean | `@${string}`;
    perky?: boolean | `@${string}`;
    playful?: boolean | `@${string}`;
    rollicking?: boolean | `@${string}`;
    upbeat?: boolean | `@${string}`;
    calm?: boolean | `@${string}`;
    contented?: boolean | `@${string}`;
    dreamy?: boolean | `@${string}`;
    introspective?: boolean | `@${string}`;
    laidBack?: boolean | `@${string}`;
    leisurely?: boolean | `@${string}`;
    lyrical?: boolean | `@${string}`;
    peaceful?: boolean | `@${string}`;
    quiet?: boolean | `@${string}`;
    relaxed?: boolean | `@${string}`;
    serene?: boolean | `@${string}`;
    soothing?: boolean | `@${string}`;
    spiritual?: boolean | `@${string}`;
    tranquil?: boolean | `@${string}`;
    bittersweet?: boolean | `@${string}`;
    blue?: boolean | `@${string}`;
    depressing?: boolean | `@${string}`;
    gloomy?: boolean | `@${string}`;
    heavy?: boolean | `@${string}`;
    lonely?: boolean | `@${string}`;
    melancholic?: boolean | `@${string}`;
    mournful?: boolean | `@${string}`;
    poignant?: boolean | `@${string}`;
    sad?: boolean | `@${string}`;
    frightening?: boolean | `@${string}`;
    horror?: boolean | `@${string}`;
    menacing?: boolean | `@${string}`;
    nightmarish?: boolean | `@${string}`;
    ominous?: boolean | `@${string}`;
    panicStricken?: boolean | `@${string}`;
    scary?: boolean | `@${string}`;
    concerned?: boolean | `@${string}`;
    determined?: boolean | `@${string}`;
    dignified?: boolean | `@${string}`;
    emotional?: boolean | `@${string}`;
    noble?: boolean | `@${string}`;
    serious?: boolean | `@${string}`;
    solemn?: boolean | `@${string}`;
    thoughtful?: boolean | `@${string}`;
    cool?: boolean | `@${string}`;
    seductive?: boolean | `@${string}`;
    sexy?: boolean | `@${string}`;
    adventurous?: boolean | `@${string}`;
    confident?: boolean | `@${string}`;
    courageous?: boolean | `@${string}`;
    resolute?: boolean | `@${string}`;
    energetic?: boolean | `@${string}`;
    epic?: boolean | `@${string}`;
    exciting?: boolean | `@${string}`;
    exhilarating?: boolean | `@${string}`;
    heroic?: boolean | `@${string}`;
    majestic?: boolean | `@${string}`;
    powerful?: boolean | `@${string}`;
    prestigious?: boolean | `@${string}`;
    relentless?: boolean | `@${string}`;
    strong?: boolean | `@${string}`;
    triumphant?: boolean | `@${string}`;
    victorious?: boolean | `@${string}`;
    delicate?: boolean | `@${string}`;
    graceful?: boolean | `@${string}`;
    hopeful?: boolean | `@${string}`;
    innocent?: boolean | `@${string}`;
    intimate?: boolean | `@${string}`;
    kind?: boolean | `@${string}`;
    light?: boolean | `@${string}`;
    loving?: boolean | `@${string}`;
    nostalgic?: boolean | `@${string}`;
    reflective?: boolean | `@${string}`;
    romantic?: boolean | `@${string}`;
    sentimental?: boolean | `@${string}`;
    soft?: boolean | `@${string}`;
    sweet?: boolean | `@${string}`;
    tender?: boolean | `@${string}`;
    warm?: boolean | `@${string}`;
    anthemic?: boolean | `@${string}`;
    aweInspiring?: boolean | `@${string}`;
    euphoric?: boolean | `@${string}`;
    inspirational?: boolean | `@${string}`;
    motivational?: boolean | `@${string}`;
    optimistic?: boolean | `@${string}`;
    positive?: boolean | `@${string}`;
    proud?: boolean | `@${string}`;
    soaring?: boolean | `@${string}`;
    uplifting?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6MoodAdvancedSegments']: AliasType<{
    anxious?: boolean | `@${string}`;
    barren?: boolean | `@${string}`;
    cold?: boolean | `@${string}`;
    creepy?: boolean | `@${string}`;
    dark?: boolean | `@${string}`;
    disturbing?: boolean | `@${string}`;
    eerie?: boolean | `@${string}`;
    evil?: boolean | `@${string}`;
    fearful?: boolean | `@${string}`;
    mysterious?: boolean | `@${string}`;
    nervous?: boolean | `@${string}`;
    restless?: boolean | `@${string}`;
    spooky?: boolean | `@${string}`;
    strange?: boolean | `@${string}`;
    supernatural?: boolean | `@${string}`;
    suspenseful?: boolean | `@${string}`;
    tense?: boolean | `@${string}`;
    weird?: boolean | `@${string}`;
    aggressive?: boolean | `@${string}`;
    agitated?: boolean | `@${string}`;
    angry?: boolean | `@${string}`;
    dangerous?: boolean | `@${string}`;
    fiery?: boolean | `@${string}`;
    intense?: boolean | `@${string}`;
    passionate?: boolean | `@${string}`;
    ponderous?: boolean | `@${string}`;
    violent?: boolean | `@${string}`;
    comedic?: boolean | `@${string}`;
    eccentric?: boolean | `@${string}`;
    funny?: boolean | `@${string}`;
    mischievous?: boolean | `@${string}`;
    quirky?: boolean | `@${string}`;
    whimsical?: boolean | `@${string}`;
    boisterous?: boolean | `@${string}`;
    boingy?: boolean | `@${string}`;
    bright?: boolean | `@${string}`;
    celebratory?: boolean | `@${string}`;
    cheerful?: boolean | `@${string}`;
    excited?: boolean | `@${string}`;
    feelGood?: boolean | `@${string}`;
    fun?: boolean | `@${string}`;
    happy?: boolean | `@${string}`;
    joyous?: boolean | `@${string}`;
    lighthearted?: boolean | `@${string}`;
    perky?: boolean | `@${string}`;
    playful?: boolean | `@${string}`;
    rollicking?: boolean | `@${string}`;
    upbeat?: boolean | `@${string}`;
    calm?: boolean | `@${string}`;
    contented?: boolean | `@${string}`;
    dreamy?: boolean | `@${string}`;
    introspective?: boolean | `@${string}`;
    laidBack?: boolean | `@${string}`;
    leisurely?: boolean | `@${string}`;
    lyrical?: boolean | `@${string}`;
    peaceful?: boolean | `@${string}`;
    quiet?: boolean | `@${string}`;
    relaxed?: boolean | `@${string}`;
    serene?: boolean | `@${string}`;
    soothing?: boolean | `@${string}`;
    spiritual?: boolean | `@${string}`;
    tranquil?: boolean | `@${string}`;
    bittersweet?: boolean | `@${string}`;
    blue?: boolean | `@${string}`;
    depressing?: boolean | `@${string}`;
    gloomy?: boolean | `@${string}`;
    heavy?: boolean | `@${string}`;
    lonely?: boolean | `@${string}`;
    melancholic?: boolean | `@${string}`;
    mournful?: boolean | `@${string}`;
    poignant?: boolean | `@${string}`;
    sad?: boolean | `@${string}`;
    frightening?: boolean | `@${string}`;
    horror?: boolean | `@${string}`;
    menacing?: boolean | `@${string}`;
    nightmarish?: boolean | `@${string}`;
    ominous?: boolean | `@${string}`;
    panicStricken?: boolean | `@${string}`;
    scary?: boolean | `@${string}`;
    concerned?: boolean | `@${string}`;
    determined?: boolean | `@${string}`;
    dignified?: boolean | `@${string}`;
    emotional?: boolean | `@${string}`;
    noble?: boolean | `@${string}`;
    serious?: boolean | `@${string}`;
    solemn?: boolean | `@${string}`;
    thoughtful?: boolean | `@${string}`;
    cool?: boolean | `@${string}`;
    seductive?: boolean | `@${string}`;
    sexy?: boolean | `@${string}`;
    adventurous?: boolean | `@${string}`;
    confident?: boolean | `@${string}`;
    courageous?: boolean | `@${string}`;
    resolute?: boolean | `@${string}`;
    energetic?: boolean | `@${string}`;
    epic?: boolean | `@${string}`;
    exciting?: boolean | `@${string}`;
    exhilarating?: boolean | `@${string}`;
    heroic?: boolean | `@${string}`;
    majestic?: boolean | `@${string}`;
    powerful?: boolean | `@${string}`;
    prestigious?: boolean | `@${string}`;
    relentless?: boolean | `@${string}`;
    strong?: boolean | `@${string}`;
    triumphant?: boolean | `@${string}`;
    victorious?: boolean | `@${string}`;
    delicate?: boolean | `@${string}`;
    graceful?: boolean | `@${string}`;
    hopeful?: boolean | `@${string}`;
    innocent?: boolean | `@${string}`;
    intimate?: boolean | `@${string}`;
    kind?: boolean | `@${string}`;
    light?: boolean | `@${string}`;
    loving?: boolean | `@${string}`;
    nostalgic?: boolean | `@${string}`;
    reflective?: boolean | `@${string}`;
    romantic?: boolean | `@${string}`;
    sentimental?: boolean | `@${string}`;
    soft?: boolean | `@${string}`;
    sweet?: boolean | `@${string}`;
    tender?: boolean | `@${string}`;
    warm?: boolean | `@${string}`;
    anthemic?: boolean | `@${string}`;
    aweInspiring?: boolean | `@${string}`;
    euphoric?: boolean | `@${string}`;
    inspirational?: boolean | `@${string}`;
    motivational?: boolean | `@${string}`;
    optimistic?: boolean | `@${string}`;
    positive?: boolean | `@${string}`;
    proud?: boolean | `@${string}`;
    soaring?: boolean | `@${string}`;
    uplifting?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Describes possible energy levels values. */
  ['AudioAnalysisV6EnergyLevel']: AudioAnalysisV6EnergyLevel;
  /** Describes possible energy dynamics values. */
  ['AudioAnalysisV6EnergyDynamics']: AudioAnalysisV6EnergyDynamics;
  /** Describes possible emotional profile values. */
  ['AudioAnalysisV6EmotionalProfile']: AudioAnalysisV6EmotionalProfile;
  /** Describes possible emotional dynamics values. */
  ['AudioAnalysisV6EmotionalDynamics']: AudioAnalysisV6EmotionalDynamics;
  /** Describes possible voice presence profile values. */
  ['AudioAnalysisV6VoicePresenceProfile']: AudioAnalysisV6VoicePresenceProfile;
  /** Describes possible predominant voice gender values. */
  ['AudioAnalysisV6PredominantVoiceGender']: AudioAnalysisV6PredominantVoiceGender;
  ['AudioAnalysisV6VoiceTags']: AudioAnalysisV6VoiceTags;
  ['AudioAnalysisV6MovementTags']: AudioAnalysisV6MovementTags;
  ['AudioAnalysisV6CharacterTags']: AudioAnalysisV6CharacterTags;
  ['AudioAnalysisV6ClassicalEpochTags']: AudioAnalysisV6ClassicalEpochTags;
  ['AudioAnalysisV6MoodAdvancedTags']: AudioAnalysisV6MoodAdvancedTags;
  ['AudioAnalysisV6Segments']: AliasType<{
    /** Index of the most representative segment for the track. */
    representativeSegmentIndex?: boolean | `@${string}`;
    /** The timestamps of each analysis segment. */
    timestamps?: boolean | `@${string}`;
    /** The mood prediction of each analysis segment. */
    mood?: ResolverInputTypes['AudioAnalysisV6MoodSegments'];
    /** The voice prediction of each analysis segment. */
    voice?: ResolverInputTypes['AudioAnalysisV6VoiceSegments'];
    /** The instrument prediction of each analysis segment. */
    instruments?: ResolverInputTypes['AudioAnalysisV6InstrumentsSegments'];
    /** The instrument prediction of each analysis segment. */
    advancedInstruments?: ResolverInputTypes['AudioAnalysisV7InstrumentsSegments'];
    /** The instrument prediction of each analysis segment. */
    advancedInstrumentsExtended?: ResolverInputTypes['AudioAnalysisV7ExtendedInstrumentsSegments'];
    /** The genre prediction of each analysis segment. */
    genre?: ResolverInputTypes['AudioAnalysisV6GenreSegments'];
    /** The sub-genre prediction of each analysis segment. */
    subgenre?: ResolverInputTypes['AudioAnalysisV6SubgenreSegments'];
    /** The EDM subgenre prediction of each analysis segments. It is null if the track has not been recognized as EDM music. */
    subgenreEdm?: ResolverInputTypes['AudioAnalysisV6SubgenreEdmSegments'];
    /** The valance prediction of each analysis segment. */
    valence?: boolean | `@${string}`;
    /** The arousal prediction of each analysis segment. */
    arousal?: boolean | `@${string}`;
    moodAdvanced?: ResolverInputTypes['AudioAnalysisV6MoodAdvancedSegments'];
    movement?: ResolverInputTypes['AudioAnalysisV6MovementSegments'];
    character?: ResolverInputTypes['AudioAnalysisV6CharacterSegments'];
    classicalEpoch?: ResolverInputTypes['AudioAnalysisV6ClassicalEpochSegments'];
    /** The genre prediction of each analysis segment. */
    advancedGenre?: ResolverInputTypes['AudioAnalysisV7GenreSegments'];
    /** The sub-genre prediction of each analysis segment. */
    advancedSubgenre?: ResolverInputTypes['AudioAnalysisV7SubgenreSegments'];
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6KeyPrediction']: AliasType<{
    /** The predicted Key value. */
    value?: boolean | `@${string}`;
    /** The confidence of predicted key value. */
    confidence?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6BPMPrediction']: AliasType<{
    /** The predicted BPM value. */
    value?: boolean | `@${string}`;
    /** The confidence of the predicted BPM value. */
    confidence?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV7InstrumentsSegments']: AliasType<{
    /** Segments prediction value for the "percussion" instrument presence. */
    percussion?: boolean | `@${string}`;
    /** Segments prediction value for the "synth" instrument presence. */
    synth?: boolean | `@${string}`;
    /** Segments prediction value for the "piano" instrument presence. */
    piano?: boolean | `@${string}`;
    /** Segments prediction value for the "acousticGuitar" instrument presence. */
    acousticGuitar?: boolean | `@${string}`;
    /** Segments prediction value for the "electricGuitar" instrument presence. */
    electricGuitar?: boolean | `@${string}`;
    /** Segments prediction value for the "strings" instrument presence. */
    strings?: boolean | `@${string}`;
    /** Segments prediction value for the "bass" instrument presence. */
    bass?: boolean | `@${string}`;
    /** Segments prediction value for the "bassGuitar" instrument presence. */
    bassGuitar?: boolean | `@${string}`;
    /** Segments prediction value for the "woodwinds" instrument presence. */
    woodwinds?: boolean | `@${string}`;
    /** Segments prediction value for the "brass" instrument presence. */
    brass?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Instruments detected by the instrument recognition. */
  ['AudioAnalysisV7InstrumentTags']: AudioAnalysisV7InstrumentTags;
  /** The intensity of an instrument's presence throughout a track. */
  ['AudioAnalysisV7InstrumentPresence']: AliasType<{
    /** Intensity of the percussion instrument. */
    percussion?: boolean | `@${string}`;
    /** Intensity of the synthesizer instrument. */
    synth?: boolean | `@${string}`;
    /** Intensity of the piano instrument. */
    piano?: boolean | `@${string}`;
    /** Intensity of the acoustic guitar instrument. */
    acousticGuitar?: boolean | `@${string}`;
    /** Intensity of the electric guitar instrument. */
    electricGuitar?: boolean | `@${string}`;
    /** Intensity of the strings instrument. */
    strings?: boolean | `@${string}`;
    /** Intensity of the bass instrument. */
    bass?: boolean | `@${string}`;
    /** Intensity of the bass guitar instrument. */
    bassGuitar?: boolean | `@${string}`;
    /** Intensity of the brass instrument. */
    brass?: boolean | `@${string}`;
    /** Intensity of the woodwinds instrument. */
    woodwinds?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV7ExtendedInstrumentsSegments']: AliasType<{
    acousticGuitar?: boolean | `@${string}`;
    bass?: boolean | `@${string}`;
    bassGuitar?: boolean | `@${string}`;
    electricGuitar?: boolean | `@${string}`;
    percussion?: boolean | `@${string}`;
    piano?: boolean | `@${string}`;
    synth?: boolean | `@${string}`;
    strings?: boolean | `@${string}`;
    brass?: boolean | `@${string}`;
    woodwinds?: boolean | `@${string}`;
    tuba?: boolean | `@${string}`;
    frenchHorn?: boolean | `@${string}`;
    oboe?: boolean | `@${string}`;
    mandolin?: boolean | `@${string}`;
    cello?: boolean | `@${string}`;
    marimba?: boolean | `@${string}`;
    vibraphone?: boolean | `@${string}`;
    electricPiano?: boolean | `@${string}`;
    electricOrgan?: boolean | `@${string}`;
    harp?: boolean | `@${string}`;
    ukulele?: boolean | `@${string}`;
    harpsichord?: boolean | `@${string}`;
    churchOrgan?: boolean | `@${string}`;
    doubleBass?: boolean | `@${string}`;
    xylophone?: boolean | `@${string}`;
    glockenspiel?: boolean | `@${string}`;
    electronicDrums?: boolean | `@${string}`;
    drumKit?: boolean | `@${string}`;
    accordion?: boolean | `@${string}`;
    violin?: boolean | `@${string}`;
    flute?: boolean | `@${string}`;
    sax?: boolean | `@${string}`;
    trumpet?: boolean | `@${string}`;
    celeste?: boolean | `@${string}`;
    pizzicato?: boolean | `@${string}`;
    banjo?: boolean | `@${string}`;
    clarinet?: boolean | `@${string}`;
    bells?: boolean | `@${string}`;
    steelDrums?: boolean | `@${string}`;
    bongoConga?: boolean | `@${string}`;
    africanPercussion?: boolean | `@${string}`;
    tabla?: boolean | `@${string}`;
    sitar?: boolean | `@${string}`;
    taiko?: boolean | `@${string}`;
    asianFlute?: boolean | `@${string}`;
    asianStrings?: boolean | `@${string}`;
    luteOud?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Instruments detected by the instrument recognition. */
  ['AudioAnalysisV7ExtendedInstrumentTags']: AudioAnalysisV7ExtendedInstrumentTags;
  /** The intensity of an instrument's presence throughout a track. */
  ['AudioAnalysisV7ExtendedInstrumentPresence']: AliasType<{
    acousticGuitar?: boolean | `@${string}`;
    bass?: boolean | `@${string}`;
    bassGuitar?: boolean | `@${string}`;
    electricGuitar?: boolean | `@${string}`;
    percussion?: boolean | `@${string}`;
    piano?: boolean | `@${string}`;
    synth?: boolean | `@${string}`;
    strings?: boolean | `@${string}`;
    brass?: boolean | `@${string}`;
    woodwinds?: boolean | `@${string}`;
    tuba?: boolean | `@${string}`;
    frenchHorn?: boolean | `@${string}`;
    oboe?: boolean | `@${string}`;
    mandolin?: boolean | `@${string}`;
    cello?: boolean | `@${string}`;
    marimba?: boolean | `@${string}`;
    vibraphone?: boolean | `@${string}`;
    electricPiano?: boolean | `@${string}`;
    electricOrgan?: boolean | `@${string}`;
    harp?: boolean | `@${string}`;
    ukulele?: boolean | `@${string}`;
    harpsichord?: boolean | `@${string}`;
    churchOrgan?: boolean | `@${string}`;
    doubleBass?: boolean | `@${string}`;
    xylophone?: boolean | `@${string}`;
    glockenspiel?: boolean | `@${string}`;
    electronicDrums?: boolean | `@${string}`;
    drumKit?: boolean | `@${string}`;
    accordion?: boolean | `@${string}`;
    violin?: boolean | `@${string}`;
    flute?: boolean | `@${string}`;
    sax?: boolean | `@${string}`;
    trumpet?: boolean | `@${string}`;
    celeste?: boolean | `@${string}`;
    pizzicato?: boolean | `@${string}`;
    banjo?: boolean | `@${string}`;
    clarinet?: boolean | `@${string}`;
    bells?: boolean | `@${string}`;
    steelDrums?: boolean | `@${string}`;
    bongoConga?: boolean | `@${string}`;
    africanPercussion?: boolean | `@${string}`;
    tabla?: boolean | `@${string}`;
    sitar?: boolean | `@${string}`;
    taiko?: boolean | `@${string}`;
    asianFlute?: boolean | `@${string}`;
    asianStrings?: boolean | `@${string}`;
    luteOud?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV7Genre']: AliasType<{
    /** Mean prediction value for the "afro" genre. */
    afro?: boolean | `@${string}`;
    /** Mean prediction value for the "ambient" genre. */
    ambient?: boolean | `@${string}`;
    /** Mean prediction value for the "arab" genre. */
    arab?: boolean | `@${string}`;
    /** Mean prediction value for the "asian" genre. */
    asian?: boolean | `@${string}`;
    /** Mean prediction value for the "blues" genre. */
    blues?: boolean | `@${string}`;
    /** Mean prediction value for the "children jingle" genre. */
    childrenJingle?: boolean | `@${string}`;
    /** Mean prediction value for the "classical" genre. */
    classical?: boolean | `@${string}`;
    /** Mean prediction value for the "electronic dance" genre. */
    electronicDance?: boolean | `@${string}`;
    /** Mean prediction value for the "folk country" genre. */
    folkCountry?: boolean | `@${string}`;
    /** Mean prediction value for the "funk soul" genre. */
    funkSoul?: boolean | `@${string}`;
    /** Mean prediction value for the "indian" genre. */
    indian?: boolean | `@${string}`;
    /** Mean prediction value for the "jazz" genre. */
    jazz?: boolean | `@${string}`;
    /** Mean prediction value for the "latin" genre. */
    latin?: boolean | `@${string}`;
    /** Mean prediction value for the "metal" genre. */
    metal?: boolean | `@${string}`;
    /** Mean prediction value for the "pop" genre. */
    pop?: boolean | `@${string}`;
    /** Mean prediction value for the "rap hip hop" genre. */
    rapHipHop?: boolean | `@${string}`;
    /** Mean prediction value for the "reggae" genre. */
    reggae?: boolean | `@${string}`;
    /** Mean prediction value for the "rnb" genre. */
    rnb?: boolean | `@${string}`;
    /** Mean prediction value for the "rock" genre. */
    rock?: boolean | `@${string}`;
    /** Mean prediction value for the "singer songwriters" genre. */
    singerSongwriters?: boolean | `@${string}`;
    /** Mean prediction value for the "sound" genre. */
    sound?: boolean | `@${string}`;
    /** Mean prediction value for the "soundtrack" genre. */
    soundtrack?: boolean | `@${string}`;
    /** Mean prediction value for the "spoken word" genre. */
    spokenWord?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV7GenreTags']: AudioAnalysisV7GenreTags;
  ['AudioAnalysisV7GenreSegments']: AliasType<{
    /** Segments prediction value for the "afro" genre */
    afro?: boolean | `@${string}`;
    /** Segments prediction value for the "ambient" genre */
    ambient?: boolean | `@${string}`;
    /** Segments prediction value for the "arab" genre */
    arab?: boolean | `@${string}`;
    /** Segments prediction value for the "asian" genre */
    asian?: boolean | `@${string}`;
    /** Segments prediction value for the "blues" genre */
    blues?: boolean | `@${string}`;
    /** Segments prediction value for the "childrenJingle" genre */
    childrenJingle?: boolean | `@${string}`;
    /** Segments prediction value for the "classical" genre */
    classical?: boolean | `@${string}`;
    /** Segments prediction value for the "electronicDance" genre */
    electronicDance?: boolean | `@${string}`;
    /** Segments prediction value for the "folkCountry" genre */
    folkCountry?: boolean | `@${string}`;
    /** Segments prediction value for the "funkSoul" genre */
    funkSoul?: boolean | `@${string}`;
    /** Segments prediction value for the "indian" genre */
    indian?: boolean | `@${string}`;
    /** Segments prediction value for the "jazz" genre */
    jazz?: boolean | `@${string}`;
    /** Segments prediction value for the "latin" genre */
    latin?: boolean | `@${string}`;
    /** Segments prediction value for the "metal" genre */
    metal?: boolean | `@${string}`;
    /** Segments prediction value for the "pop" genre */
    pop?: boolean | `@${string}`;
    /** Segments prediction value for the "rapHipHop" genre */
    rapHipHop?: boolean | `@${string}`;
    /** Segments prediction value for the "reggae" genre */
    reggae?: boolean | `@${string}`;
    /** Segments prediction value for the "rnb" genre */
    rnb?: boolean | `@${string}`;
    /** Segments prediction value for the "rock" genre */
    rock?: boolean | `@${string}`;
    /** Segments prediction value for the "singerSongwriters" genre */
    singerSongwriters?: boolean | `@${string}`;
    /** Segments prediction value for the "sound" genre */
    sound?: boolean | `@${string}`;
    /** Segments prediction value for the "soundtrack" genre */
    soundtrack?: boolean | `@${string}`;
    /** Segments prediction value for the "spokenWord" genre */
    spokenWord?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV7SubgenreSegments']: AliasType<{
    /** Segments prediction value for the "bluesRock" sub-genre. */
    bluesRock?: boolean | `@${string}`;
    /** Segments prediction value for the "folkRock" sub-genre. */
    folkRock?: boolean | `@${string}`;
    /** Segments prediction value for the "hardRock" sub-genre. */
    hardRock?: boolean | `@${string}`;
    /** Segments prediction value for the "indieAlternative" sub-genre. */
    indieAlternative?: boolean | `@${string}`;
    /** Segments prediction value for the "psychedelicProgressiveRock" sub-genre. */
    psychedelicProgressiveRock?: boolean | `@${string}`;
    /** Segments prediction value for the "punk" sub-genre. */
    punk?: boolean | `@${string}`;
    /** Segments prediction value for the "rockAndRoll" sub-genre. */
    rockAndRoll?: boolean | `@${string}`;
    /** Segments prediction value for the "popSoftRock" sub-genre. */
    popSoftRock?: boolean | `@${string}`;
    /** Segments prediction value for the "abstractIDMLeftfield" sub-genre. */
    abstractIDMLeftfield?: boolean | `@${string}`;
    /** Segments prediction value for the "breakbeatDnB" sub-genre. */
    breakbeatDnB?: boolean | `@${string}`;
    /** Segments prediction value for the "deepHouse" sub-genre. */
    deepHouse?: boolean | `@${string}`;
    /** Segments prediction value for the "electro" sub-genre. */
    electro?: boolean | `@${string}`;
    /** Segments prediction value for the "house" sub-genre. */
    house?: boolean | `@${string}`;
    /** Segments prediction value for the "minimal" sub-genre. */
    minimal?: boolean | `@${string}`;
    /** Segments prediction value for the "synthPop" sub-genre. */
    synthPop?: boolean | `@${string}`;
    /** Segments prediction value for the "techHouse" sub-genre. */
    techHouse?: boolean | `@${string}`;
    /** Segments prediction value for the "techno" sub-genre. */
    techno?: boolean | `@${string}`;
    /** Segments prediction value for the "trance" sub-genre. */
    trance?: boolean | `@${string}`;
    /** Segments prediction value for the "contemporaryRnB" sub-genre. */
    contemporaryRnB?: boolean | `@${string}`;
    /** Segments prediction value for the "gangsta" sub-genre. */
    gangsta?: boolean | `@${string}`;
    /** Segments prediction value for the "jazzyHipHop" sub-genre. */
    jazzyHipHop?: boolean | `@${string}`;
    /** Segments prediction value for the "popRap" sub-genre. */
    popRap?: boolean | `@${string}`;
    /** Segments prediction value for the "trap" sub-genre. */
    trap?: boolean | `@${string}`;
    /** Segments prediction value for the "blackMetal" sub-genre. */
    blackMetal?: boolean | `@${string}`;
    /** Segments prediction value for the "deathMetal" sub-genre. */
    deathMetal?: boolean | `@${string}`;
    /** Segments prediction value for the "doomMetal" sub-genre. */
    doomMetal?: boolean | `@${string}`;
    /** Segments prediction value for the "heavyMetal" sub-genre. */
    heavyMetal?: boolean | `@${string}`;
    /** Segments prediction value for the "metalcore" sub-genre. */
    metalcore?: boolean | `@${string}`;
    /** Segments prediction value for the "nuMetal" sub-genre. */
    nuMetal?: boolean | `@${string}`;
    /** Segments prediction value for the "disco" sub-genre. */
    disco?: boolean | `@${string}`;
    /** Segments prediction value for the "funk" sub-genre. */
    funk?: boolean | `@${string}`;
    /** Segments prediction value for the "gospel" sub-genre. */
    gospel?: boolean | `@${string}`;
    /** Segments prediction value for the "neoSoul" sub-genre. */
    neoSoul?: boolean | `@${string}`;
    /** Segments prediction value for the "soul" sub-genre. */
    soul?: boolean | `@${string}`;
    /** Segments prediction value for the "bigBandSwing" sub-genre. */
    bigBandSwing?: boolean | `@${string}`;
    /** Segments prediction value for the "bebop" sub-genre. */
    bebop?: boolean | `@${string}`;
    /** Segments prediction value for the "contemporaryJazz" sub-genre. */
    contemporaryJazz?: boolean | `@${string}`;
    /** Segments prediction value for the "easyListening" sub-genre. */
    easyListening?: boolean | `@${string}`;
    /** Segments prediction value for the "fusion" sub-genre. */
    fusion?: boolean | `@${string}`;
    /** Segments prediction value for the "latinJazz" sub-genre. */
    latinJazz?: boolean | `@${string}`;
    /** Segments prediction value for the "smoothJazz" sub-genre. */
    smoothJazz?: boolean | `@${string}`;
    /** Segments prediction value for the "country" sub-genre. */
    country?: boolean | `@${string}`;
    /** Segments prediction value for the "folk" sub-genre. */
    folk?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV7SubgenreTags']: AudioAnalysisV7SubgenreTags;
  ['AudioAnalysisV7Subgenre']: AliasType<{
    /** Mean prediction value for the "bluesRock" sub-genre. */
    bluesRock?: boolean | `@${string}`;
    /** Mean prediction value for the "folkRock" sub-genre. */
    folkRock?: boolean | `@${string}`;
    /** Mean prediction value for the "hardRock" sub-genre. */
    hardRock?: boolean | `@${string}`;
    /** Mean prediction value for the "indieAlternative" sub-genre. */
    indieAlternative?: boolean | `@${string}`;
    /** Mean prediction value for the "psychedelicProgressiveRock" sub-genre. */
    psychedelicProgressiveRock?: boolean | `@${string}`;
    /** Mean prediction value for the "punk" sub-genre. */
    punk?: boolean | `@${string}`;
    /** Mean prediction value for the "rockAndRoll" sub-genre. */
    rockAndRoll?: boolean | `@${string}`;
    /** Mean prediction value for the "popSoftRock" sub-genre. */
    popSoftRock?: boolean | `@${string}`;
    /** Mean prediction value for the "abstractIDMLeftfield" sub-genre. */
    abstractIDMLeftfield?: boolean | `@${string}`;
    /** Mean prediction value for the "breakbeatDnB" sub-genre. */
    breakbeatDnB?: boolean | `@${string}`;
    /** Mean prediction value for the "deepHouse" sub-genre. */
    deepHouse?: boolean | `@${string}`;
    /** Mean prediction value for the "electro" sub-genre. */
    electro?: boolean | `@${string}`;
    /** Mean prediction value for the "house" sub-genre. */
    house?: boolean | `@${string}`;
    /** Mean prediction value for the "minimal" sub-genre. */
    minimal?: boolean | `@${string}`;
    /** Mean prediction value for the "synthPop" sub-genre. */
    synthPop?: boolean | `@${string}`;
    /** Mean prediction value for the "techHouse" sub-genre. */
    techHouse?: boolean | `@${string}`;
    /** Mean prediction value for the "techno" sub-genre. */
    techno?: boolean | `@${string}`;
    /** Mean prediction value for the "trance" sub-genre. */
    trance?: boolean | `@${string}`;
    /** Mean prediction value for the "contemporaryRnB" sub-genre. */
    contemporaryRnB?: boolean | `@${string}`;
    /** Mean prediction value for the "gangsta" sub-genre. */
    gangsta?: boolean | `@${string}`;
    /** Mean prediction value for the "jazzyHipHop" sub-genre. */
    jazzyHipHop?: boolean | `@${string}`;
    /** Mean prediction value for the "popRap" sub-genre. */
    popRap?: boolean | `@${string}`;
    /** Mean prediction value for the "trap" sub-genre. */
    trap?: boolean | `@${string}`;
    /** Mean prediction value for the "blackMetal" sub-genre. */
    blackMetal?: boolean | `@${string}`;
    /** Mean prediction value for the "deathMetal" sub-genre. */
    deathMetal?: boolean | `@${string}`;
    /** Mean prediction value for the "doomMetal" sub-genre. */
    doomMetal?: boolean | `@${string}`;
    /** Mean prediction value for the "heavyMetal" sub-genre. */
    heavyMetal?: boolean | `@${string}`;
    /** Mean prediction value for the "metalcore" sub-genre. */
    metalcore?: boolean | `@${string}`;
    /** Mean prediction value for the "nuMetal" sub-genre. */
    nuMetal?: boolean | `@${string}`;
    /** Mean prediction value for the "disco" sub-genre. */
    disco?: boolean | `@${string}`;
    /** Mean prediction value for the "funk" sub-genre. */
    funk?: boolean | `@${string}`;
    /** Mean prediction value for the "gospel" sub-genre. */
    gospel?: boolean | `@${string}`;
    /** Mean prediction value for the "neoSoul" sub-genre. */
    neoSoul?: boolean | `@${string}`;
    /** Mean prediction value for the "soul" sub-genre. */
    soul?: boolean | `@${string}`;
    /** Mean prediction value for the "bigBandSwing" sub-genre. */
    bigBandSwing?: boolean | `@${string}`;
    /** Mean prediction value for the "bebop" sub-genre. */
    bebop?: boolean | `@${string}`;
    /** Mean prediction value for the "contemporaryJazz" sub-genre. */
    contemporaryJazz?: boolean | `@${string}`;
    /** Mean prediction value for the "easyListening" sub-genre. */
    easyListening?: boolean | `@${string}`;
    /** Mean prediction value for the "fusion" sub-genre. */
    fusion?: boolean | `@${string}`;
    /** Mean prediction value for the "latinJazz" sub-genre. */
    latinJazz?: boolean | `@${string}`;
    /** Mean prediction value for the "smoothJazz" sub-genre. */
    smoothJazz?: boolean | `@${string}`;
    /** Mean prediction value for the "country" sub-genre. */
    country?: boolean | `@${string}`;
    /** Mean prediction value for the "folk" sub-genre. */
    folk?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AudioAnalysisV6Result']: AliasType<{
    /** The prediction results for the segments of the audio. */
    segments?: ResolverInputTypes['AudioAnalysisV6Segments'];
    /** The multi-label genre prediction for the whole audio. */
    genre?: ResolverInputTypes['AudioAnalysisV6Genre'];
    genreTags?: boolean | `@${string}`;
    /** The multi-label subgenre prediction for the whole audio. */
    subgenre?: ResolverInputTypes['AudioAnalysisV6Subgenre'];
    /** List of subgenre tags the audio is classified with. */
    subgenreTags?: boolean | `@${string}`;
    subgenreEdm?: ResolverInputTypes['AudioAnalysisV6SubgenreEdm'];
    subgenreEdmTags?: boolean | `@${string}`;
    /** The multi-label mood prediction for the whole audio. */
    mood?: ResolverInputTypes['AudioAnalysisV6Mood'];
    /** List of mood tags the audio is classified with. */
    moodTags?: boolean | `@${string}`;
    moodMaxTimes?: ResolverInputTypes['AudioAnalysisV6MaximumMoodInterval'];
    voice?: ResolverInputTypes['AudioAnalysisV6Voice'];
    instruments?: ResolverInputTypes['AudioAnalysisV6Instruments'];
    /** The presence of instruments of the audio. */
    instrumentPresence?: ResolverInputTypes['AudioAnalysisV6InstrumentPresence'];
    /** List of instrument tags the audio is classified with. */
    instrumentTags?: boolean | `@${string}`;
    /** BPM of the track. */
    bpm?: boolean | `@${string}`;
    /** BPM predicted for the track. */
    bpmPrediction?: ResolverInputTypes['AudioAnalysisV6BPMPrediction'];
    /** The global estimated bpm value of the full track fixed to a custom range of 60-180 bpm. */
    bpmRangeAdjusted?: boolean | `@${string}`;
    /** The key predicted for the track. */
    key?: boolean | `@${string}`;
    /** The key predicted for the track. */
    keyPrediction?: ResolverInputTypes['AudioAnalysisV6KeyPrediction'];
    /** Time signature of the track. */
    timeSignature?: boolean | `@${string}`;
    /** The overall valance of the audio. */
    valence?: boolean | `@${string}`;
    /** The overall arousal of the audio. */
    arousal?: boolean | `@${string}`;
    /** The overall energy level of the audio. */
    energyLevel?: boolean | `@${string}`;
    /** The overall energy dynamics of the audio. */
    energyDynamics?: boolean | `@${string}`;
    /** The overall emotional profile of the audio. */
    emotionalProfile?: boolean | `@${string}`;
    /** The overall voice presence profile of the audio. */
    voicePresenceProfile?: boolean | `@${string}`;
    /** The overall emotional dynamics of the audio. */
    emotionalDynamics?: boolean | `@${string}`;
    /** The predominant voice gender of the audio. */
    predominantVoiceGender?: boolean | `@${string}`;
    /** The predicted musical era of the audio. */
    musicalEraTag?: boolean | `@${string}`;
    voiceTags?: boolean | `@${string}`;
    moodAdvanced?: ResolverInputTypes['AudioAnalysisV6MoodAdvanced'];
    moodAdvancedTags?: boolean | `@${string}`;
    movement?: ResolverInputTypes['AudioAnalysisV6Movement'];
    movementTags?: boolean | `@${string}`;
    character?: ResolverInputTypes['AudioAnalysisV6Character'];
    characterTags?: boolean | `@${string}`;
    /** This field is only available for music classified as classical. */
    classicalEpoch?: ResolverInputTypes['AudioAnalysisV6ClassicalEpoch'];
    /** This field is only available for music classified as classical. */
    classicalEpochTags?: boolean | `@${string}`;
    transformerCaption?: boolean | `@${string}`;
    /** The multi-label genre prediction for the whole audio. */
    advancedGenre?: ResolverInputTypes['AudioAnalysisV7Genre'];
    advancedGenreTags?: boolean | `@${string}`;
    /** The multi-label subgenre prediction for the whole audio. */
    advancedSubgenre?: ResolverInputTypes['AudioAnalysisV7Subgenre'];
    /** List of subgenre tags the audio is classified with. */
    advancedSubgenreTags?: boolean | `@${string}`;
    /** The presence of instruments of the audio. */
    advancedInstrumentPresence?: ResolverInputTypes['AudioAnalysisV7InstrumentPresence'];
    /** List of instrument tags the audio is classified with. */
    advancedInstrumentTags?: boolean | `@${string}`;
    /** The presence of instruments of the audio. */
    advancedInstrumentPresenceExtended?: ResolverInputTypes['AudioAnalysisV7ExtendedInstrumentPresence'];
    /** List of instrument tags the audio is classified with. */
    advancedInstrumentTagsExtended?: boolean | `@${string}`;
    /** The existence of the voiceover in this track */
    voiceoverExists?: boolean | `@${string}`;
    /** The degree of certainty that there is a voiceover */
    voiceoverDegree?: boolean | `@${string}`;
    freeGenreTags?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['LibraryTrack']: AliasType<{
    audioAnalysisV6?: ResolverInputTypes['AudioAnalysisV6'];
    /** The primary identifier. */
    id?: boolean | `@${string}`;
    /** The title of the track.
Can be specified when creating the track. */
    title?: boolean | `@${string}`;
    /** An optional external identifier
Can be specified when creating the track. */
    externalId?: boolean | `@${string}`;
    similarLibraryTracks?: [
      {
        /** When specifying crate id, the returned connection will return only tracks from that crate. */
        crateIdFilter?:
          | string
          | undefined
          | null /** Amount of items to fetch. The maximum is 100. */;
        first?: number | undefined | null;
      },
      ResolverInputTypes['SimilarLibraryTracksResult'],
    ];
    similarTracks?: [
      {
        /** Amount of items to fetch. */
        first?:
          | number
          | undefined
          | null /** The relevant parts of the track that should be used for the similarity search. */;
        searchMode?:
          | ResolverInputTypes['SimilarTracksSearchMode']
          | undefined
          | null /** What kind of results should be returned? Either Spotify or Library tracks. */;
        target: ResolverInputTypes['SimilarTracksTarget'] /** Filters to apply on to the similarity search. */;
        experimental_filter?:
          | ResolverInputTypes['experimental_SimilarTracksFilter']
          | undefined
          | null;
      },
      ResolverInputTypes['SimilarTracksResult'],
    ];
    /** Augmented keywords that can be associated with the audio. */
    augmentedKeywords?: ResolverInputTypes['AugmentedKeywordsResult'];
    /** Brand values that can be associated with the audio. */
    brandValues?: ResolverInputTypes['BrandValuesResult'];
    __typename?: boolean | `@${string}`;
  }>;
  /** Represents a track on Spotify. */
  ['SpotifyTrack']: AliasType<{
    audioAnalysisV6?: ResolverInputTypes['AudioAnalysisV6'];
    /** The ID of the track on Spotify. It can be used for fetching additional information for the Spotify API.
For further information check out the Spotify Web API Documentation. https://developer.spotify.com/documentation/web-api/ */
    id?: boolean | `@${string}`;
    title?: boolean | `@${string}`;
    similarTracks?: [
      {
        /** Amount of items to fetch. */
        first?:
          | number
          | undefined
          | null /** The relevant parts of the track that should be used for the similarity search. */;
        searchMode?:
          | ResolverInputTypes['SimilarTracksSearchMode']
          | undefined
          | null /** What kind of results should be returned? Either Spotify or Library tracks. */;
        target: ResolverInputTypes['SimilarTracksTarget'] /** Filters to apply on to the similarity search. */;
        experimental_filter?:
          | ResolverInputTypes['experimental_SimilarTracksFilter']
          | undefined
          | null;
      },
      ResolverInputTypes['SimilarTracksResult'],
    ];
    /** Augmented keywords that can be associated with the audio. */
    augmentedKeywords?: ResolverInputTypes['AugmentedKeywordsResult'];
    /** Brand values that can be associated with the audio. */
    brandValues?: ResolverInputTypes['BrandValuesResult'];
    __typename?: boolean | `@${string}`;
  }>;
  ['LibraryTrackNotFoundError']: AliasType<{
    message?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['LibraryTrackResult']: AliasType<{
    LibraryTrackNotFoundError?: ResolverInputTypes['LibraryTrackNotFoundError'];
    LibraryTrack?: ResolverInputTypes['LibraryTrack'];
    __typename?: boolean | `@${string}`;
  }>;
  ['LibraryTrackEdge']: AliasType<{
    cursor?: boolean | `@${string}`;
    node?: ResolverInputTypes['LibraryTrack'];
    __typename?: boolean | `@${string}`;
  }>;
  ['LibraryTrackConnection']: AliasType<{
    edges?: ResolverInputTypes['LibraryTrackEdge'];
    pageInfo?: ResolverInputTypes['PageInfo'];
    __typename?: boolean | `@${string}`;
  }>;
  /** An error code returned when there is a problem with retrieving similar tracks. */
  ['SimilarLibraryTracksErrorCode']: SimilarLibraryTracksErrorCode;
  /** An error object returned if an error occurred while retrieving similar tracks. */
  ['SimilarLibraryTracksError']: AliasType<{
    message?: boolean | `@${string}`;
    code?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Describes the possible types the 'LibraryTrack.similarLibraryTracks' field can return. */
  ['SimilarLibraryTracksResult']: AliasType<{
    SimilarLibraryTracksError?: ResolverInputTypes['SimilarLibraryTracksError'];
    SimilarLibraryTrackConnection?: ResolverInputTypes['SimilarLibraryTrackConnection'];
    __typename?: boolean | `@${string}`;
  }>;
  /** Filter the LibraryTrackConnection. @oneOf */
  ['LibraryTracksFilter']: {
    /** Find library tracks whose title includes a specific substring. */
    title?: string | undefined | null;
    /** Find library tracks whose source audio file sha256 hash matches. */
    sha256?: string | undefined | null;
    /** Find library tracks whose external id matches. */
    externalId?: string | undefined | null;
  };
  ['CratesConnection']: AliasType<{
    edges?: ResolverInputTypes['CrateEdge'];
    pageInfo?: ResolverInputTypes['PageInfo'];
    __typename?: boolean | `@${string}`;
  }>;
  ['CrateEdge']: AliasType<{
    cursor?: boolean | `@${string}`;
    node?: ResolverInputTypes['Crate'];
    __typename?: boolean | `@${string}`;
  }>;
  /** A type representing a crate on the Cyanite platform. */
  ['Crate']: AliasType<{
    id?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Error codes that can be returned by the 'crateCreate' mutation. */
  ['CrateCreateErrorCode']: CrateCreateErrorCode;
  /** An error object returned if an error occurred while creating a crate. */
  ['CrateCreateError']: AliasType<{
    message?: boolean | `@${string}`;
    code?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Input for 'crateDelete' Mutation. */
  ['CrateDeleteInput']: {
    /** Id of the crate that will be deleted. */
    id: string;
  };
  /** Input for 'crateCreate' Mutation. */
  ['CrateCreateInput']: {
    /** The name of the crate to be created. */
    name: string;
  };
  /** Input for 'crateAddLibraryTracks' Mutation. */
  ['CrateAddLibraryTracksInput']: {
    /** Tracks that will be put into the crate. */
    libraryTrackIds: Array<string>;
    /** Target crate id. */
    crateId: string;
  };
  /** Input for 'crateRemoveLibraryTracks' Mutation. */
  ['CrateRemoveLibraryTracksInput']: {
    /** Tracks that will be removed from the crate. */
    libraryTrackIds: Array<string>;
    /** Target crate id. */
    crateId: string;
  };
  /** Describes the possible types that the 'crateCreate' Mutation can return. */
  ['CrateCreateResult']: AliasType<{
    CrateCreateSuccess?: ResolverInputTypes['CrateCreateSuccess'];
    CrateCreateError?: ResolverInputTypes['CrateCreateError'];
    __typename?: boolean | `@${string}`;
  }>;
  /** The crate was created successfully. */
  ['CrateCreateSuccess']: AliasType<{
    /** Id of the newly created crate. */
    id?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Describes the possible types that the 'crateDelete' Mutation can return. */
  ['CrateDeleteResult']: AliasType<{
    CrateDeleteSuccess?: ResolverInputTypes['CrateDeleteSuccess'];
    CrateDeleteError?: ResolverInputTypes['CrateDeleteError'];
    __typename?: boolean | `@${string}`;
  }>;
  /** The crate was deleted successfully. */
  ['CrateDeleteSuccess']: AliasType<{
    _?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Error codes that can be returned by the 'crateDelete' Mutation. */
  ['CrateDeleteErrorCode']: CrateDeleteErrorCode;
  /** An error object returned if an error occurred while deleting a crate. */
  ['CrateDeleteError']: AliasType<{
    message?: boolean | `@${string}`;
    code?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Describes the possible types that the 'crateAddLibraryTracks' Mutation can return. */
  ['CrateAddLibraryTracksResult']: AliasType<{
    CrateAddLibraryTracksSuccess?: ResolverInputTypes['CrateAddLibraryTracksSuccess'];
    CrateAddLibraryTracksError?: ResolverInputTypes['CrateAddLibraryTracksError'];
    __typename?: boolean | `@${string}`;
  }>;
  /** The tracks were successfully added to the crate. */
  ['CrateAddLibraryTracksSuccess']: AliasType<{
    /** The IDs of the library tracks that were added to the crate. */
    addedLibraryTrackIds?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An error object returned if an error occurred while adding the tracks to the crate. */
  ['CrateAddLibraryTracksError']: AliasType<{
    message?: boolean | `@${string}`;
    code?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Error codes that can be returned by the 'crateAddLibraryTracks' Mutation. */
  ['CrateAddLibraryTracksErrorCode']: CrateAddLibraryTracksErrorCode;
  /** Describes the possible types that the 'crateRemoveLibraryTracks' Mutation can return. */
  ['CrateRemoveLibraryTracksResult']: AliasType<{
    CrateRemoveLibraryTracksSuccess?: ResolverInputTypes['CrateRemoveLibraryTracksSuccess'];
    CrateRemoveLibraryTracksError?: ResolverInputTypes['CrateRemoveLibraryTracksError'];
    __typename?: boolean | `@${string}`;
  }>;
  /** The tracks were successfully removed from the crate. */
  ['CrateRemoveLibraryTracksSuccess']: AliasType<{
    /** The IDs of the library tracks that were removed from the crate. */
    removedLibraryTrackIds?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Error codes that can be returned by the 'crateRemoveLibraryTracks' Mutation. */
  ['CrateRemoveLibraryTracksError']: AliasType<{
    message?: boolean | `@${string}`;
    code?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Error codes that can be returned by the 'crateRemoveLibraryTracks' Mutation. */
  ['CrateRemoveLibraryTracksErrorCode']: CrateRemoveLibraryTracksErrorCode;
  ['LibraryTrackCreateInput']: {
    /** The id of the upload requested via the 'fileUploadRequest' Mutation. */
    uploadId: string;
    /** An optional title that is set for the 'LibraryTrack'.
The character limit for the title is 150. */
    title?: string | undefined | null;
    /** An optional external identifier that is set for the 'LibraryTrack'.
The character limit for the external id is 150. */
    externalId?: string | undefined | null;
  };
  /** Describes a successful LibraryTrack creation. */
  ['LibraryTrackCreateSuccess']: AliasType<{
    /** The newly created LibraryTrack. */
    createdLibraryTrack?: ResolverInputTypes['LibraryTrack'];
    /** Whether the track was enqueued successfully or not. */
    enqueueResult?: ResolverInputTypes['LibraryTrackEnqueueResult'];
    __typename?: boolean | `@${string}`;
  }>;
  ['LibraryTrackCreateErrorCode']: LibraryTrackCreateErrorCode;
  /** Describes a failed LibraryTrack creation. */
  ['LibraryTrackCreateError']: AliasType<{
    /** An error that describes the reason for the failed LibraryTrack creation. */
    code?: boolean | `@${string}`;
    /** A human readable message that describes the reason for the failed LibraryTrack creation. */
    message?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Describes the possible types the 'libraryTrackCreate' Mutation can return. */
  ['LibraryTrackCreateResult']: AliasType<{
    LibraryTrackCreateSuccess?: ResolverInputTypes['LibraryTrackCreateSuccess'];
    LibraryTrackCreateError?: ResolverInputTypes['LibraryTrackCreateError'];
    __typename?: boolean | `@${string}`;
  }>;
  ['LibraryTrackEnqueueSuccess']: AliasType<{
    enqueuedLibraryTrack?: ResolverInputTypes['LibraryTrack'];
    __typename?: boolean | `@${string}`;
  }>;
  ['LibraryTrackEnqueueErrorCode']: LibraryTrackEnqueueErrorCode;
  ['LibraryTrackEnqueueError']: AliasType<{
    /** An error that describes the reason for the failed LibraryTrack creation. */
    code?: boolean | `@${string}`;
    /** A human readable message that describes the reason for the failed LibraryTrack creation. */
    message?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['LibraryTrackEnqueueResult']: AliasType<{
    LibraryTrackEnqueueSuccess?: ResolverInputTypes['LibraryTrackEnqueueSuccess'];
    LibraryTrackEnqueueError?: ResolverInputTypes['LibraryTrackEnqueueError'];
    __typename?: boolean | `@${string}`;
  }>;
  ['LibraryTrackEnqueueInput']: {
    /** The id of the LibraryTrack that should be enqueued. */
    libraryTrackId: string;
  };
  /** Describes the possible types the 'libraryTracksDelete' Mutation can return. */
  ['LibraryTracksDeleteResult']: AliasType<{
    LibraryTracksDeleteSuccess?: ResolverInputTypes['LibraryTracksDeleteSuccess'];
    LibraryTracksDeleteError?: ResolverInputTypes['LibraryTracksDeleteError'];
    __typename?: boolean | `@${string}`;
  }>;
  ['LibraryTracksDeleteErrorCode']: LibraryTracksDeleteErrorCode;
  ['LibraryTracksDeleteError']: AliasType<{
    /** Error code. */
    code?: boolean | `@${string}`;
    /** A human readable message that describes why the operation has failed. */
    message?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['LibraryTracksDeleteSuccess']: AliasType<{
    /** The IDs of deleted LibraryTracks. */
    libraryTrackIds?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['LibraryTracksDeleteInput']: {
    /** The IDs of the LibraryTracks that should be deleted. */
    libraryTrackIds: Array<string>;
  };
  ['YouTubeTrackEnqueueResult']: AliasType<{
    YouTubeTrackEnqueueError?: ResolverInputTypes['YouTubeTrackEnqueueError'];
    YouTubeTrackEnqueueSuccess?: ResolverInputTypes['YouTubeTrackEnqueueSuccess'];
    __typename?: boolean | `@${string}`;
  }>;
  ['YouTubeTrackEnqueueErrorCode']: YouTubeTrackEnqueueErrorCode;
  ['YouTubeTrackEnqueueError']: AliasType<{
    /** A human readable message that describes why the operation has failed. */
    message?: boolean | `@${string}`;
    /** Error code if applicable */
    code?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['YouTubeTrackEnqueueSuccess']: AliasType<{
    enqueuedLibraryTrack?: ResolverInputTypes['LibraryTrack'];
    __typename?: boolean | `@${string}`;
  }>;
  ['YouTubeTrackEnqueueInput']: {
    /** YouTube video URL */
    videoUrl: string;
  };
  ['SpotifyTrackError']: AliasType<{
    message?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['SpotifyTrackResult']: AliasType<{
    SpotifyTrackError?: ResolverInputTypes['SpotifyTrackError'];
    SpotifyTrack?: ResolverInputTypes['SpotifyTrack'];
    __typename?: boolean | `@${string}`;
  }>;
  ['SpotifyTrackEnqueueInput']: {
    spotifyTrackId: string;
  };
  ['SpotifyTrackEnqueueError']: AliasType<{
    message?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['SpotifyTrackEnqueueSuccess']: AliasType<{
    enqueuedSpotifyTrack?: ResolverInputTypes['SpotifyTrack'];
    __typename?: boolean | `@${string}`;
  }>;
  ['SpotifyTrackEnqueueResult']: AliasType<{
    SpotifyTrackEnqueueError?: ResolverInputTypes['SpotifyTrackEnqueueError'];
    SpotifyTrackEnqueueSuccess?: ResolverInputTypes['SpotifyTrackEnqueueSuccess'];
    __typename?: boolean | `@${string}`;
  }>;
  /** Possible error codes of 'Track.similarTracks'. */
  ['SimilarTracksErrorCode']: SimilarTracksErrorCode;
  /** An error object returned if an error occurred while performing a similarity search. */
  ['SimilarTracksError']: AliasType<{
    code?: boolean | `@${string}`;
    message?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['SimilarTracksEdge']: AliasType<{
    cursor?: boolean | `@${string}`;
    node?: ResolverInputTypes['Track'];
    __typename?: boolean | `@${string}`;
  }>;
  ['SimilarTracksConnection']: AliasType<{
    pageInfo?: ResolverInputTypes['PageInfo'];
    edges?: ResolverInputTypes['SimilarTracksEdge'];
    __typename?: boolean | `@${string}`;
  }>;
  /** Describes the possible types that the 'Track.similarTracks' field can return. */
  ['SimilarTracksResult']: AliasType<{
    SimilarTracksError?: ResolverInputTypes['SimilarTracksError'];
    SimilarTracksConnection?: ResolverInputTypes['SimilarTracksConnection'];
    __typename?: boolean | `@${string}`;
  }>;
  /** Musical keys */
  ['MusicalKey']: MusicalKey;
  /** List of musical genres. */
  ['MusicalGenre']: MusicalGenre;
  ['SimilarTracksSearchModeInterval']: {
    /** Start of the interval in seconds. */
    start: number;
    /** End of the interval in seconds. */
    end: number;
  };
  /** The search mode used for the similarity search.
Only one of the fields of this input type should be provided.
By default the 'mostRepresentative' mode will be used.

@oneOf */
  ['SimilarTracksSearchMode']: {
    /** Use the part of the track that is most representative as the criteria for finding similar tracks (Default mode). */
    mostRepresentative?: boolean | undefined | null;
    /** Use the complete track as the criteria for finding similar tracks. */
    complete?: boolean | undefined | null;
    /** Use the part of the track specified by the interval as the criteria for finding similar tracks. */
    interval?:
      | ResolverInputTypes['SimilarTracksSearchModeInterval']
      | undefined
      | null;
  };
  /** Return similar tracks from a library. */
  ['SimilarTracksTargetLibrary']: {
    _?: boolean | undefined | null;
  };
  /** Return similar tracks from Spotify. */
  ['SimilarTracksTargetSpotify']: {
    _?: boolean | undefined | null;
  };
  /** Return similar tracks from a crate. */
  ['SimilarTracksTargetCrate']: {
    /** The crate id from which similar tracks should be returned. */
    crateId: string;
  };
  /** SimilarTracksTarget
Only one of the fields of this input type should be provided.
@oneOf */
  ['SimilarTracksTarget']: {
    /** Return LibraryTrack results. */
    library?:
      | ResolverInputTypes['SimilarTracksTargetLibrary']
      | undefined
      | null;
    /** Return LibraryTracks from a specific crate. */
    crate?: ResolverInputTypes['SimilarTracksTargetCrate'] | undefined | null;
    /** Return SpotifyTrack results. */
    spotify?:
      | ResolverInputTypes['SimilarTracksTargetSpotify']
      | undefined
      | null;
  };
  ['experimental_SimilarTracksFilterBpmInput']: {
    _?: boolean | undefined | null;
  };
  ['experimental_SimilarTracksFilterBpmRange']: {
    start: number;
    end: number;
  };
  /** The BPM filter config.
Only one of the fields of this input type should be provided.
@oneOf */
  ['experimental_SimilarTracksFilterBpm']: {
    /** Use a BPM range around the input track (+-6%) */
    input?:
      | ResolverInputTypes['experimental_SimilarTracksFilterBpmInput']
      | undefined
      | null;
    /** Use a custom BPM range */
    range?:
      | ResolverInputTypes['experimental_SimilarTracksFilterBpmRange']
      | undefined
      | null;
  };
  ['experimental_SimilarTracksFilterGenreInput']: {
    _?: boolean | undefined | null;
  };
  /** The Genre filter config.
Only one of the fields of this input type should be provided.
@oneOf */
  ['experimental_SimilarTracksFilterGenre']: {
    /** Use a genre from the input track */
    input?:
      | ResolverInputTypes['experimental_SimilarTracksFilterGenreInput']
      | undefined
      | null;
    /** Use a list of genres to filter for */
    list?: Array<ResolverInputTypes['MusicalGenre']> | undefined | null;
  };
  ['experimental_SimilarTracksFilterKeyCamelotInput']: {
    _?: boolean | undefined | null;
  };
  /** The Camelot key filter config.
Only one of the fields of this input type should be provided.
SimilarTracksKeyFilter @oneOf */
  ['experimental_SimilarTracksFilterKeyCamelot']: {
    /** Use key from the input track. */
    input?:
      | ResolverInputTypes['experimental_SimilarTracksFilterKeyCamelotInput']
      | undefined
      | null;
    /** Use custom key. */
    key?: ResolverInputTypes['MusicalKey'] | undefined | null;
  };
  ['experimental_SimilarTracksFilterKeyMatchingInput']: {
    _?: boolean | undefined | null;
  };
  /** The key key filter config.
Only one of the fields of this input type should be provided.
SimilarTracksKeyFilter @oneOf */
  ['experimental_SimilarTracksFilterKeyMatching']: {
    /** Use key from the input track. */
    input?:
      | ResolverInputTypes['experimental_SimilarTracksFilterKeyMatchingInput']
      | undefined
      | null;
    /** Use list of custom keys. */
    list?: Array<ResolverInputTypes['MusicalKey']> | undefined | null;
  };
  /** The Key filter config.
Only one of the fields of this input type should be provided.
@oneOf */
  ['experimental_SimilarTracksFilterKey']: {
    /** When set, will use Camelot filtering. */
    camelot?:
      | ResolverInputTypes['experimental_SimilarTracksFilterKeyCamelot']
      | undefined
      | null;
    /** When set, will use key filtering. */
    matching?:
      | ResolverInputTypes['experimental_SimilarTracksFilterKeyMatching']
      | undefined
      | null;
  };
  /** Describes the possible filters that can be applied for the search. */
  ['experimental_SimilarTracksFilter']: {
    /** Filter the search results by a BPM range. */
    bpm?:
      | ResolverInputTypes['experimental_SimilarTracksFilterBpm']
      | undefined
      | null;
    /** Filter the search results by a list of genres. */
    genre?:
      | ResolverInputTypes['experimental_SimilarTracksFilterGenre']
      | undefined
      | null;
    /** Filter the search results by one of the possible key filters.
Default: no key filter applied */
    key?:
      | ResolverInputTypes['experimental_SimilarTracksFilterKey']
      | undefined
      | null;
  };
  ['KeywordSearchKeyword']: {
    weight: number;
    keyword: string;
  };
  /** An error code returned when there is a problem with retrieving similar tracks. */
  ['KeywordSearchErrorCode']: KeywordSearchErrorCode;
  ['KeywordSearchError']: AliasType<{
    message?: boolean | `@${string}`;
    code?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['KeywordSearchResult']: AliasType<{
    KeywordSearchConnection?: ResolverInputTypes['KeywordSearchConnection'];
    KeywordSearchError?: ResolverInputTypes['KeywordSearchError'];
    __typename?: boolean | `@${string}`;
  }>;
  ['Keyword']: AliasType<{
    keyword?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['KeywordEdge']: AliasType<{
    node?: ResolverInputTypes['Keyword'];
    cursor?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['KeywordConnection']: AliasType<{
    pageInfo?: ResolverInputTypes['PageInfo'];
    edges?: ResolverInputTypes['KeywordEdge'];
    __typename?: boolean | `@${string}`;
  }>;
  /** Return tracks from a library. */
  ['KeywordSearchTargetLibrary']: {
    _?: boolean | undefined | null;
  };
  /** Return tracks from a crate. */
  ['KeywordSearchTargetCrate']: {
    /** The crate id from which tracks should be returned. */
    crateId: string;
  };
  /** Return similar tracks from Spotify. */
  ['KeywordSearchTargetSpotify']: {
    _?: boolean | undefined | null;
  };
  /** KeywordSearchTarget
Only one of the fields of this input type should be provided.
@oneOf */
  ['KeywordSearchTarget']: {
    /** Return LibraryTrack results. */
    library?:
      | ResolverInputTypes['KeywordSearchTargetLibrary']
      | undefined
      | null;
    /** Return LibraryTracks from a specific crate. */
    crate?: ResolverInputTypes['KeywordSearchTargetCrate'] | undefined | null;
    /** Return SpotifyTrack results. */
    spotify?:
      | ResolverInputTypes['KeywordSearchTargetSpotify']
      | undefined
      | null;
  };
  ['KeywordSearchEdge']: AliasType<{
    node?: ResolverInputTypes['Track'];
    cursor?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['KeywordSearchConnection']: AliasType<{
    pageInfo?: ResolverInputTypes['PageInfo'];
    edges?: ResolverInputTypes['KeywordSearchEdge'];
    __typename?: boolean | `@${string}`;
  }>;
  ['AugmentedKeyword']: AliasType<{
    keyword?: boolean | `@${string}`;
    weight?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AugmentedKeywords']: AliasType<{
    keywords?: ResolverInputTypes['AugmentedKeyword'];
    __typename?: boolean | `@${string}`;
  }>;
  ['AugmentedKeywordsErrorCode']: AugmentedKeywordsErrorCode;
  ['AugmentedKeywordsError']: AliasType<{
    message?: boolean | `@${string}`;
    code?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['AugmentedKeywordsResult']: AliasType<{
    AugmentedKeywordsError?: ResolverInputTypes['AugmentedKeywordsError'];
    AugmentedKeywords?: ResolverInputTypes['AugmentedKeywords'];
    __typename?: boolean | `@${string}`;
  }>;
  ['BrandValuesSuccess']: AliasType<{
    values?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['SelectBrandValuesInput']: {
    /** Values must comply with available brand values */
    values: Array<string>;
  };
  ['SelectBrandValuesSuccess']: AliasType<{
    success?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['SelectBrandValuesResult']: AliasType<{
    BrandValuesError?: ResolverInputTypes['BrandValuesError'];
    SelectBrandValuesSuccess?: ResolverInputTypes['SelectBrandValuesSuccess'];
    __typename?: boolean | `@${string}`;
  }>;
  ['BrandValuesResult']: AliasType<{
    BrandValuesError?: ResolverInputTypes['BrandValuesError'];
    BrandValuesSuccess?: ResolverInputTypes['BrandValuesSuccess'];
    BrandValues?: ResolverInputTypes['BrandValues'];
    __typename?: boolean | `@${string}`;
  }>;
  ['BrandValue']: AliasType<{
    value?: boolean | `@${string}`;
    weight?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['BrandValues']: AliasType<{
    values?: ResolverInputTypes['BrandValue'];
    __typename?: boolean | `@${string}`;
  }>;
  ['BrandValuesErrorCode']: BrandValuesErrorCode;
  ['BrandValuesError']: AliasType<{
    message?: boolean | `@${string}`;
    code?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['FreeTextSearchErrorCode']: FreeTextSearchErrorCode;
  ['FreeTextSearchTargetLibrary']: {
    libraryUserId?: string | undefined | null;
  };
  ['FreeTextSearchTargetCrate']: {
    crateId: string;
  };
  ['FreeTextSearchTargetSpotify']: {
    _?: boolean | undefined | null;
  };
  ['FreeTextSearchTarget']: {
    library?:
      | ResolverInputTypes['FreeTextSearchTargetLibrary']
      | undefined
      | null;
    crate?: ResolverInputTypes['FreeTextSearchTargetCrate'] | undefined | null;
    spotify?:
      | ResolverInputTypes['FreeTextSearchTargetSpotify']
      | undefined
      | null;
  };
  ['FreeTextSearchError']: AliasType<{
    code?: boolean | `@${string}`;
    message?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ['FreeTextSearchEdge']: AliasType<{
    cursor?: boolean | `@${string}`;
    node?: ResolverInputTypes['Track'];
    __typename?: boolean | `@${string}`;
  }>;
  ['FreeTextSearchConnection']: AliasType<{
    pageInfo?: ResolverInputTypes['PageInfo'];
    edges?: ResolverInputTypes['FreeTextSearchEdge'];
    __typename?: boolean | `@${string}`;
  }>;
  /** Describes the possible types that the 'freeTextSearch' field can return. */
  ['FreeTextSearchResult']: AliasType<{
    FreeTextSearchError?: ResolverInputTypes['FreeTextSearchError'];
    FreeTextSearchConnection?: ResolverInputTypes['FreeTextSearchConnection'];
    __typename?: boolean | `@${string}`;
  }>;
  ['LyricsSearchErrorCode']: LyricsSearchErrorCode;
  /** The Spotify target for lyrics search */
  ['LyricsSearchTargetSpotify']: {
    _?: boolean | undefined | null;
  };
  /** Search target to perform the lyrics search on. Currently only Spotify is available. */
  ['LyricsSearchTarget']: {
    spotify?:
      | ResolverInputTypes['LyricsSearchTargetSpotify']
      | undefined
      | null;
  };
  /** Error type if search cannot be performed. Contains the code and a message. */
  ['LyricsSearchError']: AliasType<{
    code?: boolean | `@${string}`;
    message?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The edge for lyrics search for cursor based pagination. */
  ['LyricsSearchEdge']: AliasType<{
    cursor?: boolean | `@${string}`;
    node?: ResolverInputTypes['Track'];
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection for lyrics search for cursor based pagination. */
  ['LyricsSearchConnection']: AliasType<{
    pageInfo?: ResolverInputTypes['PageInfo'];
    edges?: ResolverInputTypes['LyricsSearchEdge'];
    __typename?: boolean | `@${string}`;
  }>;
  /** Describes the possible types that the 'lyricsSearch' field can return. */
  ['LyricsSearchResult']: AliasType<{
    LyricsSearchError?: ResolverInputTypes['LyricsSearchError'];
    LyricsSearchConnection?: ResolverInputTypes['LyricsSearchConnection'];
    __typename?: boolean | `@${string}`;
  }>;
  ['schema']: AliasType<{
    query?: ResolverInputTypes['Query'];
    mutation?: ResolverInputTypes['Mutation'];
    subscription?: ResolverInputTypes['Subscription'];
    __typename?: boolean | `@${string}`;
  }>;
};

export type ModelTypes = {
  ['Error']:
    | ModelTypes['NoSimilarSpotifyTracksAvailableError']
    | ModelTypes['SpotifySimilarLibraryTracksError']
    | ModelTypes['SpotifyTrackNotFoundError']
    | ModelTypes['SpotifyTrackWithoutPreviewUrlError']
    | ModelTypes['AudioAnalysisV6Error']
    | ModelTypes['LibraryTrackNotFoundError']
    | ModelTypes['SimilarLibraryTracksError']
    | ModelTypes['CrateCreateError']
    | ModelTypes['CrateDeleteError']
    | ModelTypes['CrateAddLibraryTracksError']
    | ModelTypes['CrateRemoveLibraryTracksError']
    | ModelTypes['LibraryTrackCreateError']
    | ModelTypes['LibraryTrackEnqueueError']
    | ModelTypes['LibraryTracksDeleteError']
    | ModelTypes['SpotifyTrackError']
    | ModelTypes['SpotifyTrackEnqueueError']
    | ModelTypes['SimilarTracksError']
    | ModelTypes['KeywordSearchError']
    | ModelTypes['AugmentedKeywordsError']
    | ModelTypes['BrandValuesError']
    | ModelTypes['FreeTextSearchError']
    | ModelTypes['LyricsSearchError'];
  /** Relay Style PageInfo (https://facebook.github.io/relay/graphql/connections.htm) */
  ['PageInfo']: {
    hasNextPage: boolean;
  };
  ['SpotifyArtistInfo']: {
    id: string;
    name: string;
  };
  ['SpotifyTrackInfo']: {
    id: string;
    name: string;
    artists: Array<ModelTypes['SpotifyArtistInfo']>;
  };
  ['TrackAnalysisScores']: {
    excited: number;
    euphoric: number;
    uplifting: number;
    angry: number;
    tense: number;
    melancholic: number;
    relaxed: number;
    happy: number;
    sad: number;
    dark: number;
    pumped: number;
    energetic: number;
    calm: number;
  };
  ['TrackAnalysis']: {
    arousal: number;
    valence: number;
    scores: ModelTypes['TrackAnalysisScores'];
  };
  ['AnalysisStatus']: AnalysisStatus;
  ['FileInfo']: {
    duration: number;
    fileSizeKb: number;
    bitrate: number;
    sampleRate: number;
  };
  ['TrackSegmentAnalysis']: {
    start: number;
    /** the timestamp this segment belongs to */
    timestamp: number;
    duration: number;
    analysis: ModelTypes['TrackAnalysis'];
  };
  ['FileAnalysisLabel']: {
    /** file analysis label title */
    title: string;
    /** identifier of the mood score this label represents */
    type: string;
    /** start of the interval */
    start: number;
    /** end of the interval */
    end: number;
    /** intensity of the mood score for the given interval */
    amount: number;
  };
  ['Mutation']: {
    ping?: boolean | undefined;
    /** Create a cyanite file upload request. */
    fileUploadRequest: ModelTypes['FileUploadRequest'];
    /** Allows creating a crate in order to be able to group tracks within your library. */
    crateCreate: ModelTypes['CrateCreateResult'];
    /** Deletes an existing crate. */
    crateDelete: ModelTypes['CrateDeleteResult'];
    /** Adds multiple library tracks to a crate. */
    crateAddLibraryTracks: ModelTypes['CrateAddLibraryTracksResult'];
    /** Removes multiple library tracks from a crate. */
    crateRemoveLibraryTracks: ModelTypes['CrateRemoveLibraryTracksResult'];
    /** Create a LibraryTrack and automatically enqueue all the eligible analysis types. */
    libraryTrackCreate: ModelTypes['LibraryTrackCreateResult'];
    /** Enqueue a LibraryTrack manually.
This might be necessary when the automatic enqueuing performed via the 'libraryTrackCreate' mutation
fails due to having exceeded the analysis limit or a new analysis type is available. */
    libraryTrackEnqueue: ModelTypes['LibraryTrackEnqueueResult'];
    /** Deletes selected library tracks. CAUTION: This operation cannot be undone!
Allows to delete at most 100 tracks at once. */
    libraryTracksDelete: ModelTypes['LibraryTracksDeleteResult'];
    /** Enqueues YouTube analysis */
    youTubeTrackEnqueue: ModelTypes['YouTubeTrackEnqueueResult'];
    /** Enqueue a SpotifyTrack. */
    spotifyTrackEnqueue: ModelTypes['SpotifyTrackEnqueueResult'];
    /** Select your own set of brand values (up to 20) */
    selectBrandValues: ModelTypes['SelectBrandValuesResult'];
  };
  ['Query']: {
    ping?: boolean | undefined;
    spotifyTrackAnalysis: ModelTypes['SpotifyTrackAnalysisResult'];
    libraryTrack: ModelTypes['LibraryTrackResult'];
    libraryTracks: ModelTypes['LibraryTrackConnection'];
    /** Returns crates created by the user. */
    crates: ModelTypes['CratesConnection'];
    /** Retrieve a SpotifyTrack via ID. */
    spotifyTrack: ModelTypes['SpotifyTrackResult'];
    /** Find tracks that match specific keywords. */
    keywordSearch: ModelTypes['KeywordSearchResult'];
    /** Search for keywords that can be used for the keyword search. */
    keywords: ModelTypes['KeywordConnection'];
    /** Get a list of all available brand values */
    brandValues: ModelTypes['BrandValuesResult'];
    freeTextSearch: ModelTypes['FreeTextSearchResult'];
    lyricsSearch: ModelTypes['LyricsSearchResult'];
  };
  ['Subscription']: {
    ping?: boolean | undefined;
  };
  ['InDepthAnalysisGenre']: {
    title: string;
    confidence: number;
  };
  /** This type is deprecated and will be removed in the future. */
  ['NoSimilarSpotifyTracksAvailableError']: {
    message: string;
  };
  /** This union type is deprecated and will be removed in the future. */
  ['SimilarSpotifyTracksResult']:
    | ModelTypes['NoSimilarSpotifyTracksAvailableError']
    | ModelTypes['SimilarSpotifyTrackConnection'];
  ['SimilarLibraryTrackNode']: {
    distance: number;
    sort: number;
    inDepthAnalysisId: string;
    libraryTrack: ModelTypes['LibraryTrack'];
  };
  ['SimilarLibraryTrackEdge']: {
    cursor: string;
    node: ModelTypes['SimilarLibraryTrackNode'];
  };
  ['SimilarLibraryTrackConnection']: {
    pageInfo: ModelTypes['PageInfo'];
    edges: Array<ModelTypes['SimilarLibraryTrackEdge']>;
  };
  ['SimilaritySearchWeightFilter']: {
    genre?: number | undefined;
    mood?: number | undefined;
    voice?: number | undefined;
    mfccs?: number | undefined;
  };
  ['EnergyLevel']: EnergyLevel;
  ['EnergyDynamics']: EnergyDynamics;
  ['EmotionalProfile']: EmotionalProfile;
  ['EmotionalDynamics']: EmotionalDynamics;
  ['VoicePresenceProfile']: VoicePresenceProfile;
  ['PredominantVoiceGender']: PredominantVoiceGender;
  /** Describes the voice classifier results over time, mapped to the index of the timestamps. */
  ['VoiceSegmentScores']: {
    /** Scores for female voice, mapped to the index of the timestamp. */
    female: Array<number | undefined>;
    /** Scores for instrumental, mapped to the index of the timestamp. */
    instrumental: Array<number | undefined>;
    /** Scores for male voice, mapped to the index of the timestamp. */
    male: Array<number | undefined>;
  };
  /** Describes the mean scores of the voice classifier result. */
  ['VoiceMeanScores']: {
    /** Mean female score. */
    female: number;
    /** Mean instrumental score. */
    instrumental: number;
    /** Mean instrumental male score. */
    male: number;
  };
  ['FileUploadRequest']: {
    id: string;
    uploadUrl: string;
  };
  ['InDepthAnalysisCreateInput']: {
    fileName: string;
    uploadId: string;
    organizationId?: string | undefined;
    externalId?: string | undefined;
    /** The associated file tag name. It can later on be used for filtering. */
    tags?: Array<string> | undefined;
    /** Whether the file should be enqueued automatically */
    enqueue?: boolean | undefined;
  };
  /** This type is deprecated and will be removed in the future. */
  ['SimilarSpotifyTrackNode']: {
    distance: number;
    score: number;
    spotifyTrackId: string;
    trackInfo: ModelTypes['SpotifyTrackInfo'];
  };
  /** This type is deprecated and will be removed in the future */
  ['SimilarSpotifyTrackEdge']: {
    cursor: string;
    node: ModelTypes['SimilarSpotifyTrackNode'];
  };
  /** This type is deprecated and will be removed in the future */
  ['SimilarSpotifyTrackConnection']: {
    pageInfo: ModelTypes['PageInfo'];
    edges: Array<ModelTypes['SimilarSpotifyTrackEdge']>;
  };
  /** spotify analysis related stuff */
  ['SpotifyTrackAnalysis']: {
    id: string;
    status: ModelTypes['AnalysisStatus'];
    similarLibraryTracks: ModelTypes['SpotifySimilarLibraryTracks'];
  };
  /** This type is deprecated and will be removed in the future. */
  ['SpotifySimilarLibraryTracks']:
    | ModelTypes['SpotifySimilarLibraryTracksResult']
    | ModelTypes['SpotifySimilarLibraryTracksError'];
  /** This type is deprecated and will be removed in the future. */
  ['SpotifySimilarLibraryTracksResult']: {
    results: Array<ModelTypes['LibraryTrack']>;
  };
  /** This type is deprecated and will be removed in the future. */
  ['SpotifySimilarLibraryTracksError']: {
    code: string;
    message: string;
  };
  ['SpotifyTrackNotFoundError']: {
    message: string;
  };
  ['SpotifyTrackWithoutPreviewUrlError']: {
    message: string;
  };
  ['SpotifyTrackAnalysisResult']:
    | ModelTypes['SpotifyTrackAnalysis']
    | ModelTypes['SpotifyTrackNotFoundError']
    | ModelTypes['SpotifyTrackWithoutPreviewUrlError'];
  ['Track']: ModelTypes['LibraryTrack'] | ModelTypes['SpotifyTrack'];
  /** Possible results of querying Audio Analysis V6. */
  ['AudioAnalysisV6']:
    | ModelTypes['AudioAnalysisV6NotStarted']
    | ModelTypes['AudioAnalysisV6Enqueued']
    | ModelTypes['AudioAnalysisV6Processing']
    | ModelTypes['AudioAnalysisV6Finished']
    | ModelTypes['AudioAnalysisV6Failed'];
  /** Audio Analysis V6 hasn't been started for this track yet. */
  ['AudioAnalysisV6NotStarted']: {
    _?: boolean | undefined;
  };
  /** Audio Analysis V6 is enqueued and will be processed soon. */
  ['AudioAnalysisV6Enqueued']: {
    _?: boolean | undefined;
  };
  /** Audio Analysis V6 is being processed. */
  ['AudioAnalysisV6Processing']: {
    _?: boolean | undefined;
  };
  /** Audio Analysis V6 is completed and the results can be retrieved. */
  ['AudioAnalysisV6Finished']: {
    result: ModelTypes['AudioAnalysisV6Result'];
  };
  /** Audio Analysis V6 failed. */
  ['AudioAnalysisV6Failed']: {
    /** More detailed information on why the analysis has failed. */
    error: ModelTypes['AudioAnalysisV6Error'];
  };
  ['AudioAnalysisV6Error']: {
    message: string;
  };
  ['AudioAnalysisV6GenreTags']: AudioAnalysisV6GenreTags;
  ['AudioAnalysisV6SubgenreEdmTags']: AudioAnalysisV6SubgenreEdmTags;
  ['AudioAnalysisV6MoodTags']: AudioAnalysisV6MoodTags;
  /** Describes a track segment where the particular mood is most prominent. */
  ['AudioAnalysisV6MaximumMoodInterval']: {
    mood: ModelTypes['AudioAnalysisV6MoodTags'];
    /** Start of the segment in seconds. */
    start: number;
    /** End of the segment in seconds. */
    end: number;
  };
  ['AudioAnalysisV6Genre']: {
    /** Mean prediction value for the "ambient" genre. */
    ambient: number;
    /** Mean prediction value for the "blues" genre. */
    blues: number;
    /** Mean prediction value for the "classical" genre. */
    classical: number;
    /** Mean prediction value for the "country" genre. */
    country: number;
    /** Mean prediction value for the "electronicDance" genre. */
    electronicDance: number;
    /** Mean prediction value for the "folk" genre. */
    folk: number;
    /** Mean prediction value for the "folkCountry" genre. */
    folkCountry: number;
    /** Mean prediction value for the "indieAlternative" genre. */
    indieAlternative: number;
    /** Mean prediction value for the "funkSoul" genre. */
    funkSoul: number;
    /** Mean prediction value for the "jazz" genre. */
    jazz: number;
    /** Mean prediction value for the "latin" genre. */
    latin: number;
    /** Mean prediction value for the "metal" genre. */
    metal: number;
    /** Mean prediction value for the "pop" genre. */
    pop: number;
    /** Mean prediction value for the "punk" genre. */
    punk: number;
    /** Mean prediction value for the "rapHipHop" genre. */
    rapHipHop: number;
    /** Mean prediction value for the "reggae" genre. */
    reggae: number;
    /** Mean prediction value for the "rnb" genre. */
    rnb: number;
    /** Mean prediction value for the "rock" genre. */
    rock: number;
    /** Mean prediction value for the "singerSongwriter" genre. */
    singerSongwriter: number;
  };
  ['AudioAnalysisV6GenreSegments']: {
    /** Segments prediction value for the "ambient" genre. */
    ambient: Array<number>;
    /** Segments prediction value for the "blues" genre. */
    blues: Array<number>;
    /** Segments prediction value for the "classical" genre. */
    classical: Array<number>;
    /** Segments prediction value for the "country" genre. */
    country: Array<number>;
    /** Segments prediction value for the "electronicDance" genre. */
    electronicDance: Array<number>;
    /** Segments prediction value for the "folk" genre. */
    folk: Array<number>;
    /** Segments prediction value for the "folkCountry" genre. */
    folkCountry: Array<number>;
    /** Segments prediction value for the "indieAlternative" genre. */
    indieAlternative: Array<number>;
    /** Segments prediction value for the "funkSoul" genre. */
    funkSoul: Array<number>;
    /** Segments prediction value for the "jazz" genre. */
    jazz: Array<number>;
    /** Segments prediction value for the "latin" genre. */
    latin: Array<number>;
    /** Segments prediction value for the "metal" genre. */
    metal: Array<number>;
    /** Segments prediction value for the "pop" genre. */
    pop: Array<number>;
    /** Segments prediction value for the "punk" genre. */
    punk: Array<number>;
    /** Segments prediction value for the "rapHipHop" genre. */
    rapHipHop: Array<number>;
    /** Segments prediction value for the "reggae" genre. */
    reggae: Array<number>;
    /** Segments prediction value for the "rnb" genre. */
    rnb: Array<number>;
    /** Segments prediction value for the "rock" genre. */
    rock: Array<number>;
    /** Segments prediction value for the "singerSongwriter" genre. */
    singerSongwriter: Array<number>;
  };
  ['AudioAnalysisV6SubgenreSegments']: {
    /** Segments prediction value for the "bluesRock" sub-genre. */
    bluesRock?: Array<number> | undefined;
    /** Segments prediction value for the "folkRock" sub-genre. */
    folkRock?: Array<number> | undefined;
    /** Segments prediction value for the "hardRock" sub-genre. */
    hardRock?: Array<number> | undefined;
    /** Segments prediction value for the "indieAlternative" sub-genre. */
    indieAlternative?: Array<number> | undefined;
    /** Segments prediction value for the "psychedelicProgressiveRock" sub-genre. */
    psychedelicProgressiveRock?: Array<number> | undefined;
    /** Segments prediction value for the "punk" sub-genre. */
    punk?: Array<number> | undefined;
    /** Segments prediction value for the "rockAndRoll" sub-genre. */
    rockAndRoll?: Array<number> | undefined;
    /** Segments prediction value for the "popSoftRock" sub-genre. */
    popSoftRock?: Array<number> | undefined;
    /** Segments prediction value for the "abstractIDMLeftfield" sub-genre. */
    abstractIDMLeftfield?: Array<number> | undefined;
    /** Segments prediction value for the "breakbeatDnB" sub-genre. */
    breakbeatDnB?: Array<number> | undefined;
    /** Segments prediction value for the "deepHouse" sub-genre. */
    deepHouse?: Array<number> | undefined;
    /** Segments prediction value for the "electro" sub-genre. */
    electro?: Array<number> | undefined;
    /** Segments prediction value for the "house" sub-genre. */
    house?: Array<number> | undefined;
    /** Segments prediction value for the "minimal" sub-genre. */
    minimal?: Array<number> | undefined;
    /** Segments prediction value for the "synthPop" sub-genre. */
    synthPop?: Array<number> | undefined;
    /** Segments prediction value for the "techHouse" sub-genre. */
    techHouse?: Array<number> | undefined;
    /** Segments prediction value for the "techno" sub-genre. */
    techno?: Array<number> | undefined;
    /** Segments prediction value for the "trance" sub-genre. */
    trance?: Array<number> | undefined;
    /** Segments prediction value for the "contemporaryRnB" sub-genre. */
    contemporaryRnB?: Array<number> | undefined;
    /** Segments prediction value for the "gangsta" sub-genre. */
    gangsta?: Array<number> | undefined;
    /** Segments prediction value for the "jazzyHipHop" sub-genre. */
    jazzyHipHop?: Array<number> | undefined;
    /** Segments prediction value for the "popRap" sub-genre. */
    popRap?: Array<number> | undefined;
    /** Segments prediction value for the "trap" sub-genre. */
    trap?: Array<number> | undefined;
    /** Segments prediction value for the "blackMetal" sub-genre. */
    blackMetal?: Array<number> | undefined;
    /** Segments prediction value for the "deathMetal" sub-genre. */
    deathMetal?: Array<number> | undefined;
    /** Segments prediction value for the "doomMetal" sub-genre. */
    doomMetal?: Array<number> | undefined;
    /** Segments prediction value for the "heavyMetal" sub-genre. */
    heavyMetal?: Array<number> | undefined;
    /** Segments prediction value for the "metalcore" sub-genre. */
    metalcore?: Array<number> | undefined;
    /** Segments prediction value for the "nuMetal" sub-genre. */
    nuMetal?: Array<number> | undefined;
    /** Segments prediction value for the "disco" sub-genre. */
    disco?: Array<number> | undefined;
    /** Segments prediction value for the "funk" sub-genre. */
    funk?: Array<number> | undefined;
    /** Segments prediction value for the "gospel" sub-genre. */
    gospel?: Array<number> | undefined;
    /** Segments prediction value for the "neoSoul" sub-genre. */
    neoSoul?: Array<number> | undefined;
    /** Segments prediction value for the "soul" sub-genre. */
    soul?: Array<number> | undefined;
    /** Segments prediction value for the "bigBandSwing" sub-genre. */
    bigBandSwing?: Array<number> | undefined;
    /** Segments prediction value for the "bebop" sub-genre. */
    bebop?: Array<number> | undefined;
    /** Segments prediction value for the "contemporaryJazz" sub-genre. */
    contemporaryJazz?: Array<number> | undefined;
    /** Segments prediction value for the "easyListening" sub-genre. */
    easyListening?: Array<number> | undefined;
    /** Segments prediction value for the "fusion" sub-genre. */
    fusion?: Array<number> | undefined;
    /** Segments prediction value for the "latinJazz" sub-genre. */
    latinJazz?: Array<number> | undefined;
    /** Segments prediction value for the "smoothJazz" sub-genre. */
    smoothJazz?: Array<number> | undefined;
    /** Segments prediction value for the "country" sub-genre. */
    country?: Array<number> | undefined;
    /** Segments prediction value for the "folk" sub-genre. */
    folk?: Array<number> | undefined;
  };
  /** This type is fully deprecated all the subgenre EDM values moved to the AudioAnalysisV6Subgenre type. */
  ['AudioAnalysisV6SubgenreEdm']: {
    /** Mean prediction value for the "breakbeatDrumAndBass" EDM subgenre. */
    breakbeatDrumAndBass: number;
    /** Mean prediction value for the "deepHouse" EDM subgenre. */
    deepHouse: number;
    /** Mean prediction value for the "electro" EDM subgenre. */
    electro: number;
    /** Mean prediction value for the "house" EDM subgenre. */
    house: number;
    /** Mean prediction value for the "minimal" EDM subgenre. */
    minimal: number;
    /** Mean prediction value for the "techHouse" EDM subgenre. */
    techHouse: number;
    /** Mean prediction value for the "techno" EDM subgenre. */
    techno: number;
    /** Mean prediction value for the "trance" EDM subgenre. */
    trance: number;
  };
  ['AudioAnalysisV6SubgenreTags']: AudioAnalysisV6SubgenreTags;
  ['AudioAnalysisV6Subgenre']: {
    /** Mean prediction value for the "bluesRock" sub-genre. */
    bluesRock?: number | undefined;
    /** Mean prediction value for the "folkRock" sub-genre. */
    folkRock?: number | undefined;
    /** Mean prediction value for the "hardRock" sub-genre. */
    hardRock?: number | undefined;
    /** Mean prediction value for the "indieAlternative" sub-genre. */
    indieAlternative?: number | undefined;
    /** Mean prediction value for the "psychedelicProgressiveRock" sub-genre. */
    psychedelicProgressiveRock?: number | undefined;
    /** Mean prediction value for the "punk" sub-genre. */
    punk?: number | undefined;
    /** Mean prediction value for the "rockAndRoll" sub-genre. */
    rockAndRoll?: number | undefined;
    /** Mean prediction value for the "popSoftRock" sub-genre. */
    popSoftRock?: number | undefined;
    /** Mean prediction value for the "abstractIDMLeftfield" sub-genre. */
    abstractIDMLeftfield?: number | undefined;
    /** Mean prediction value for the "breakbeatDnB" sub-genre. */
    breakbeatDnB?: number | undefined;
    /** Mean prediction value for the "deepHouse" sub-genre. */
    deepHouse?: number | undefined;
    /** Mean prediction value for the "electro" sub-genre. */
    electro?: number | undefined;
    /** Mean prediction value for the "house" sub-genre. */
    house?: number | undefined;
    /** Mean prediction value for the "minimal" sub-genre. */
    minimal?: number | undefined;
    /** Mean prediction value for the "synthPop" sub-genre. */
    synthPop?: number | undefined;
    /** Mean prediction value for the "techHouse" sub-genre. */
    techHouse?: number | undefined;
    /** Mean prediction value for the "techno" sub-genre. */
    techno?: number | undefined;
    /** Mean prediction value for the "trance" sub-genre. */
    trance?: number | undefined;
    /** Mean prediction value for the "contemporaryRnB" sub-genre. */
    contemporaryRnB?: number | undefined;
    /** Mean prediction value for the "gangsta" sub-genre. */
    gangsta?: number | undefined;
    /** Mean prediction value for the "jazzyHipHop" sub-genre. */
    jazzyHipHop?: number | undefined;
    /** Mean prediction value for the "popRap" sub-genre. */
    popRap?: number | undefined;
    /** Mean prediction value for the "trap" sub-genre. */
    trap?: number | undefined;
    /** Mean prediction value for the "blackMetal" sub-genre. */
    blackMetal?: number | undefined;
    /** Mean prediction value for the "deathMetal" sub-genre. */
    deathMetal?: number | undefined;
    /** Mean prediction value for the "doomMetal" sub-genre. */
    doomMetal?: number | undefined;
    /** Mean prediction value for the "heavyMetal" sub-genre. */
    heavyMetal?: number | undefined;
    /** Mean prediction value for the "metalcore" sub-genre. */
    metalcore?: number | undefined;
    /** Mean prediction value for the "nuMetal" sub-genre. */
    nuMetal?: number | undefined;
    /** Mean prediction value for the "disco" sub-genre. */
    disco?: number | undefined;
    /** Mean prediction value for the "funk" sub-genre. */
    funk?: number | undefined;
    /** Mean prediction value for the "gospel" sub-genre. */
    gospel?: number | undefined;
    /** Mean prediction value for the "neoSoul" sub-genre. */
    neoSoul?: number | undefined;
    /** Mean prediction value for the "soul" sub-genre. */
    soul?: number | undefined;
    /** Mean prediction value for the "bigBandSwing" sub-genre. */
    bigBandSwing?: number | undefined;
    /** Mean prediction value for the "bebop" sub-genre. */
    bebop?: number | undefined;
    /** Mean prediction value for the "contemporaryJazz" sub-genre. */
    contemporaryJazz?: number | undefined;
    /** Mean prediction value for the "easyListening" sub-genre. */
    easyListening?: number | undefined;
    /** Mean prediction value for the "fusion" sub-genre. */
    fusion?: number | undefined;
    /** Mean prediction value for the "latinJazz" sub-genre. */
    latinJazz?: number | undefined;
    /** Mean prediction value for the "smoothJazz" sub-genre. */
    smoothJazz?: number | undefined;
    /** Mean prediction value for the "country" sub-genre. */
    country?: number | undefined;
    /** Mean prediction value for the "folk" sub-genre. */
    folk?: number | undefined;
  };
  ['AudioAnalysisV6Mood']: {
    /** Mean prediction value for the "aggressive" mood. */
    aggressive: number;
    /** Mean prediction value for the "calm" mood. */
    calm: number;
    /** Mean prediction value for the "chilled" mood. */
    chilled: number;
    /** Mean prediction value for the "dark" mood. */
    dark: number;
    /** Mean prediction value for the "energetic" mood. */
    energetic: number;
    /** Mean prediction value for the "epic" mood. */
    epic: number;
    /** Mean prediction value for the "happy" mood. */
    happy: number;
    /** Mean prediction value for the "romantic" mood. */
    romantic: number;
    /** Mean prediction value for the "sad" mood. */
    sad: number;
    /** Mean prediction value for the "scary" mood. */
    scary: number;
    /** Mean prediction value for the "sexy" mood. */
    sexy: number;
    /** Mean prediction value for the "ethereal" mood. */
    ethereal: number;
    /** Mean prediction value for the "uplifting" mood. */
    uplifting: number;
  };
  ['AudioAnalysisV6MoodSegments']: {
    /** Segments prediction value for the "aggressive" mood. */
    aggressive: Array<number>;
    /** Segments prediction value for the "calm" mood. */
    calm: Array<number>;
    /** Segments prediction value for the "chilled" mood. */
    chilled: Array<number>;
    /** Segments prediction value for the "dark" mood. */
    dark: Array<number>;
    /** Segments prediction value for the "energetic" mood. */
    energetic: Array<number>;
    /** Segments prediction value for the "epic" mood. */
    epic: Array<number>;
    /** Segments prediction value for the "happy" mood. */
    happy: Array<number>;
    /** Segments prediction value for the "romantic" mood. */
    romantic: Array<number>;
    /** Segments prediction value for the "sad" mood. */
    sad: Array<number>;
    /** Segments prediction value for the "scary" mood. */
    scary: Array<number>;
    /** Segments prediction value for the "sexy" mood. */
    sexy: Array<number>;
    /** Segments prediction value for the "ethereal" mood. */
    ethereal: Array<number>;
    /** Segments prediction value for the "uplifting" mood. */
    uplifting: Array<number>;
  };
  ['AudioAnalysisV6Instruments']: {
    /** Mean prediction value for the "percussion" instrument presence. */
    percussion: number;
  };
  ['AudioAnalysisV6InstrumentTags']: AudioAnalysisV6InstrumentTags;
  ['AudioAnalysisInstrumentPresenceLabel']: AudioAnalysisInstrumentPresenceLabel;
  /** The intensity of an instrument's presence throughout a track. */
  ['AudioAnalysisV6InstrumentPresence']: {
    /** Intensity of the percussion instrument. */
    percussion: ModelTypes['AudioAnalysisInstrumentPresenceLabel'];
    /** Intensity of the synthesizer instrument. */
    synth: ModelTypes['AudioAnalysisInstrumentPresenceLabel'];
    /** Intensity of the piano instrument. */
    piano: ModelTypes['AudioAnalysisInstrumentPresenceLabel'];
    /** Intensity of the acoustic guitar instrument. */
    acousticGuitar: ModelTypes['AudioAnalysisInstrumentPresenceLabel'];
    /** Intensity of the electric guitar instrument. */
    electricGuitar: ModelTypes['AudioAnalysisInstrumentPresenceLabel'];
    /** Intensity of the strings instrument. */
    strings: ModelTypes['AudioAnalysisInstrumentPresenceLabel'];
    /** Intensity of the bass instrument. */
    bass: ModelTypes['AudioAnalysisInstrumentPresenceLabel'];
    /** Intensity of the bass guitar instrument. */
    bassGuitar: ModelTypes['AudioAnalysisInstrumentPresenceLabel'];
    /** Intensity of the brass/woodwinds instrument. */
    brassWoodwinds: ModelTypes['AudioAnalysisInstrumentPresenceLabel'];
  };
  ['AudioAnalysisV6InstrumentsSegments']: {
    /** Segments prediction value for the "percussion" instrument presence. */
    percussion: Array<number>;
    /** Segments prediction value for the "synth" instrument presence. */
    synth: Array<number>;
    /** Segments prediction value for the "piano" instrument presence. */
    piano: Array<number>;
    /** Segments prediction value for the "acousticGuitar" instrument presence. */
    acousticGuitar: Array<number>;
    /** Segments prediction value for the "electricGuitar" instrument presence. */
    electricGuitar: Array<number>;
    /** Segments prediction value for the "strings" instrument presence. */
    strings: Array<number>;
    /** Segments prediction value for the "bass" instrument presence. */
    bass: Array<number>;
    /** Segments prediction value for the "bassGuitar" instrument presence. */
    bassGuitar: Array<number>;
    /** Segments prediction value for the "brassWoodwinds" instrument presence. */
    brassWoodwinds: Array<number>;
  };
  ['AudioAnalysisV6Voice']: {
    /** Mean prediction value for the "female" voice type. */
    female: number;
    /** Mean prediction value for the "instrumental" voice type. */
    instrumental: number;
    /** Mean prediction value for the "male" voice type. */
    male: number;
  };
  ['AudioAnalysisV6VoiceSegments']: {
    /** Segments prediction value for the "female" voice type. */
    female: Array<number>;
    /** Segments prediction value for the "instrumental" voice type. */
    instrumental: Array<number>;
    /** Segments prediction value for the "male" voice type. */
    male: Array<number>;
  };
  ['AudioAnalysisV6SubgenreEdmSegments']: {
    /** Segments prediction value for the "breakbeatDrumAndBass" EDM subgenre. */
    breakbeatDrumAndBass: Array<number>;
    /** Segments prediction value for the "deepHouse" EDM subgenre. */
    deepHouse: Array<number>;
    /** Segments prediction value for the "electro" EDM subgenre. */
    electro: Array<number>;
    /** Segments prediction value for the "house" EDM subgenre. */
    house: Array<number>;
    /** Segments prediction value for the "minimal" EDM subgenre. */
    minimal: Array<number>;
    /** Segments prediction value for the "techHouse" EDM subgenre. */
    techHouse: Array<number>;
    /** Segments prediction value for the "techno" EDM subgenre. */
    techno: Array<number>;
    /** Segments prediction value for the "trance" EDM subgenre. */
    trance: Array<number>;
  };
  ['AudioAnalysisV6Movement']: {
    bouncy: number;
    driving: number;
    flowing: number;
    groovy: number;
    nonrhythmic: number;
    pulsing: number;
    robotic: number;
    running: number;
    steady: number;
    stomping: number;
  };
  ['AudioAnalysisV6MovementSegments']: {
    bouncy: Array<number>;
    driving: Array<number>;
    flowing: Array<number>;
    groovy: Array<number>;
    nonrhythmic: Array<number>;
    pulsing: Array<number>;
    robotic: Array<number>;
    running: Array<number>;
    steady: Array<number>;
    stomping: Array<number>;
  };
  ['AudioAnalysisV6Character']: {
    bold: number;
    cool: number;
    epic: number;
    ethereal: number;
    heroic: number;
    luxurious: number;
    magical: number;
    mysterious: number;
    playful: number;
    powerful: number;
    retro: number;
    sophisticated: number;
    sparkling: number;
    sparse: number;
    unpolished: number;
    warm: number;
  };
  ['AudioAnalysisV6CharacterSegments']: {
    bold: Array<number>;
    cool: Array<number>;
    epic: Array<number>;
    ethereal: Array<number>;
    heroic: Array<number>;
    luxurious: Array<number>;
    magical: Array<number>;
    mysterious: Array<number>;
    playful: Array<number>;
    powerful: Array<number>;
    retro: Array<number>;
    sophisticated: Array<number>;
    sparkling: Array<number>;
    sparse: Array<number>;
    unpolished: Array<number>;
    warm: Array<number>;
  };
  ['AudioAnalysisV6ClassicalEpoch']: {
    middleAge: number;
    renaissance: number;
    baroque: number;
    classical: number;
    romantic: number;
    contemporary: number;
  };
  ['AudioAnalysisV6ClassicalEpochSegments']: {
    middleAge: Array<number>;
    renaissance: Array<number>;
    baroque: Array<number>;
    classical: Array<number>;
    romantic: Array<number>;
    contemporary: Array<number>;
  };
  ['AudioAnalysisV6MoodAdvanced']: {
    anxious: number;
    barren: number;
    cold: number;
    creepy: number;
    dark: number;
    disturbing: number;
    eerie: number;
    evil: number;
    fearful: number;
    mysterious: number;
    nervous: number;
    restless: number;
    spooky: number;
    strange: number;
    supernatural: number;
    suspenseful: number;
    tense: number;
    weird: number;
    aggressive: number;
    agitated: number;
    angry: number;
    dangerous: number;
    fiery: number;
    intense: number;
    passionate: number;
    ponderous: number;
    violent: number;
    comedic: number;
    eccentric: number;
    funny: number;
    mischievous: number;
    quirky: number;
    whimsical: number;
    boisterous: number;
    boingy: number;
    bright: number;
    celebratory: number;
    cheerful: number;
    excited: number;
    feelGood: number;
    fun: number;
    happy: number;
    joyous: number;
    lighthearted: number;
    perky: number;
    playful: number;
    rollicking: number;
    upbeat: number;
    calm: number;
    contented: number;
    dreamy: number;
    introspective: number;
    laidBack: number;
    leisurely: number;
    lyrical: number;
    peaceful: number;
    quiet: number;
    relaxed: number;
    serene: number;
    soothing: number;
    spiritual: number;
    tranquil: number;
    bittersweet: number;
    blue: number;
    depressing: number;
    gloomy: number;
    heavy: number;
    lonely: number;
    melancholic: number;
    mournful: number;
    poignant: number;
    sad: number;
    frightening: number;
    horror: number;
    menacing: number;
    nightmarish: number;
    ominous: number;
    panicStricken: number;
    scary: number;
    concerned: number;
    determined: number;
    dignified: number;
    emotional: number;
    noble: number;
    serious: number;
    solemn: number;
    thoughtful: number;
    cool: number;
    seductive: number;
    sexy: number;
    adventurous: number;
    confident: number;
    courageous: number;
    resolute: number;
    energetic: number;
    epic: number;
    exciting: number;
    exhilarating: number;
    heroic: number;
    majestic: number;
    powerful: number;
    prestigious: number;
    relentless: number;
    strong: number;
    triumphant: number;
    victorious: number;
    delicate: number;
    graceful: number;
    hopeful: number;
    innocent: number;
    intimate: number;
    kind: number;
    light: number;
    loving: number;
    nostalgic: number;
    reflective: number;
    romantic: number;
    sentimental: number;
    soft: number;
    sweet: number;
    tender: number;
    warm: number;
    anthemic: number;
    aweInspiring: number;
    euphoric: number;
    inspirational: number;
    motivational: number;
    optimistic: number;
    positive: number;
    proud: number;
    soaring: number;
    uplifting: number;
  };
  ['AudioAnalysisV6MoodAdvancedSegments']: {
    anxious: Array<number>;
    barren: Array<number>;
    cold: Array<number>;
    creepy: Array<number>;
    dark: Array<number>;
    disturbing: Array<number>;
    eerie: Array<number>;
    evil: Array<number>;
    fearful: Array<number>;
    mysterious: Array<number>;
    nervous: Array<number>;
    restless: Array<number>;
    spooky: Array<number>;
    strange: Array<number>;
    supernatural: Array<number>;
    suspenseful: Array<number>;
    tense: Array<number>;
    weird: Array<number>;
    aggressive: Array<number>;
    agitated: Array<number>;
    angry: Array<number>;
    dangerous: Array<number>;
    fiery: Array<number>;
    intense: Array<number>;
    passionate: Array<number>;
    ponderous: Array<number>;
    violent: Array<number>;
    comedic: Array<number>;
    eccentric: Array<number>;
    funny: Array<number>;
    mischievous: Array<number>;
    quirky: Array<number>;
    whimsical: Array<number>;
    boisterous: Array<number>;
    boingy: Array<number>;
    bright: Array<number>;
    celebratory: Array<number>;
    cheerful: Array<number>;
    excited: Array<number>;
    feelGood: Array<number>;
    fun: Array<number>;
    happy: Array<number>;
    joyous: Array<number>;
    lighthearted: Array<number>;
    perky: Array<number>;
    playful: Array<number>;
    rollicking: Array<number>;
    upbeat: Array<number>;
    calm: Array<number>;
    contented: Array<number>;
    dreamy: Array<number>;
    introspective: Array<number>;
    laidBack: Array<number>;
    leisurely: Array<number>;
    lyrical: Array<number>;
    peaceful: Array<number>;
    quiet: Array<number>;
    relaxed: Array<number>;
    serene: Array<number>;
    soothing: Array<number>;
    spiritual: Array<number>;
    tranquil: Array<number>;
    bittersweet: Array<number>;
    blue: Array<number>;
    depressing: Array<number>;
    gloomy: Array<number>;
    heavy: Array<number>;
    lonely: Array<number>;
    melancholic: Array<number>;
    mournful: Array<number>;
    poignant: Array<number>;
    sad: Array<number>;
    frightening: Array<number>;
    horror: Array<number>;
    menacing: Array<number>;
    nightmarish: Array<number>;
    ominous: Array<number>;
    panicStricken: Array<number>;
    scary: Array<number>;
    concerned: Array<number>;
    determined: Array<number>;
    dignified: Array<number>;
    emotional: Array<number>;
    noble: Array<number>;
    serious: Array<number>;
    solemn: Array<number>;
    thoughtful: Array<number>;
    cool: Array<number>;
    seductive: Array<number>;
    sexy: Array<number>;
    adventurous: Array<number>;
    confident: Array<number>;
    courageous: Array<number>;
    resolute: Array<number>;
    energetic: Array<number>;
    epic: Array<number>;
    exciting: Array<number>;
    exhilarating: Array<number>;
    heroic: Array<number>;
    majestic: Array<number>;
    powerful: Array<number>;
    prestigious: Array<number>;
    relentless: Array<number>;
    strong: Array<number>;
    triumphant: Array<number>;
    victorious: Array<number>;
    delicate: Array<number>;
    graceful: Array<number>;
    hopeful: Array<number>;
    innocent: Array<number>;
    intimate: Array<number>;
    kind: Array<number>;
    light: Array<number>;
    loving: Array<number>;
    nostalgic: Array<number>;
    reflective: Array<number>;
    romantic: Array<number>;
    sentimental: Array<number>;
    soft: Array<number>;
    sweet: Array<number>;
    tender: Array<number>;
    warm: Array<number>;
    anthemic: Array<number>;
    aweInspiring: Array<number>;
    euphoric: Array<number>;
    inspirational: Array<number>;
    motivational: Array<number>;
    optimistic: Array<number>;
    positive: Array<number>;
    proud: Array<number>;
    soaring: Array<number>;
    uplifting: Array<number>;
  };
  ['AudioAnalysisV6EnergyLevel']: AudioAnalysisV6EnergyLevel;
  ['AudioAnalysisV6EnergyDynamics']: AudioAnalysisV6EnergyDynamics;
  ['AudioAnalysisV6EmotionalProfile']: AudioAnalysisV6EmotionalProfile;
  ['AudioAnalysisV6EmotionalDynamics']: AudioAnalysisV6EmotionalDynamics;
  ['AudioAnalysisV6VoicePresenceProfile']: AudioAnalysisV6VoicePresenceProfile;
  ['AudioAnalysisV6PredominantVoiceGender']: AudioAnalysisV6PredominantVoiceGender;
  ['AudioAnalysisV6VoiceTags']: AudioAnalysisV6VoiceTags;
  ['AudioAnalysisV6MovementTags']: AudioAnalysisV6MovementTags;
  ['AudioAnalysisV6CharacterTags']: AudioAnalysisV6CharacterTags;
  ['AudioAnalysisV6ClassicalEpochTags']: AudioAnalysisV6ClassicalEpochTags;
  ['AudioAnalysisV6MoodAdvancedTags']: AudioAnalysisV6MoodAdvancedTags;
  ['AudioAnalysisV6Segments']: {
    /** Index of the most representative segment for the track. */
    representativeSegmentIndex: number;
    /** The timestamps of each analysis segment. */
    timestamps: Array<number>;
    /** The mood prediction of each analysis segment. */
    mood?: ModelTypes['AudioAnalysisV6MoodSegments'] | undefined;
    /** The voice prediction of each analysis segment. */
    voice?: ModelTypes['AudioAnalysisV6VoiceSegments'] | undefined;
    /** The instrument prediction of each analysis segment. */
    instruments?: ModelTypes['AudioAnalysisV6InstrumentsSegments'] | undefined;
    /** The instrument prediction of each analysis segment. */
    advancedInstruments?:
      | ModelTypes['AudioAnalysisV7InstrumentsSegments']
      | undefined;
    /** The instrument prediction of each analysis segment. */
    advancedInstrumentsExtended?:
      | ModelTypes['AudioAnalysisV7ExtendedInstrumentsSegments']
      | undefined;
    /** The genre prediction of each analysis segment. */
    genre?: ModelTypes['AudioAnalysisV6GenreSegments'] | undefined;
    /** The sub-genre prediction of each analysis segment. */
    subgenre?: ModelTypes['AudioAnalysisV6SubgenreSegments'] | undefined;
    /** The EDM subgenre prediction of each analysis segments. It is null if the track has not been recognized as EDM music. */
    subgenreEdm?: ModelTypes['AudioAnalysisV6SubgenreEdmSegments'] | undefined;
    /** The valance prediction of each analysis segment. */
    valence?: Array<number> | undefined;
    /** The arousal prediction of each analysis segment. */
    arousal?: Array<number> | undefined;
    moodAdvanced?:
      | ModelTypes['AudioAnalysisV6MoodAdvancedSegments']
      | undefined;
    movement?: ModelTypes['AudioAnalysisV6MovementSegments'] | undefined;
    character?: ModelTypes['AudioAnalysisV6CharacterSegments'] | undefined;
    classicalEpoch?:
      | ModelTypes['AudioAnalysisV6ClassicalEpochSegments']
      | undefined;
    /** The genre prediction of each analysis segment. */
    advancedGenre?: ModelTypes['AudioAnalysisV7GenreSegments'] | undefined;
    /** The sub-genre prediction of each analysis segment. */
    advancedSubgenre?:
      | ModelTypes['AudioAnalysisV7SubgenreSegments']
      | undefined;
  };
  ['AudioAnalysisV6KeyPrediction']: {
    /** The predicted Key value. */
    value: ModelTypes['MusicalKey'];
    /** The confidence of predicted key value. */
    confidence?: number | undefined;
  };
  ['AudioAnalysisV6BPMPrediction']: {
    /** The predicted BPM value. */
    value: number;
    /** The confidence of the predicted BPM value. */
    confidence?: number | undefined;
  };
  ['AudioAnalysisV7InstrumentsSegments']: {
    /** Segments prediction value for the "percussion" instrument presence. */
    percussion?: Array<number> | undefined;
    /** Segments prediction value for the "synth" instrument presence. */
    synth?: Array<number> | undefined;
    /** Segments prediction value for the "piano" instrument presence. */
    piano?: Array<number> | undefined;
    /** Segments prediction value for the "acousticGuitar" instrument presence. */
    acousticGuitar?: Array<number> | undefined;
    /** Segments prediction value for the "electricGuitar" instrument presence. */
    electricGuitar?: Array<number> | undefined;
    /** Segments prediction value for the "strings" instrument presence. */
    strings?: Array<number> | undefined;
    /** Segments prediction value for the "bass" instrument presence. */
    bass?: Array<number> | undefined;
    /** Segments prediction value for the "bassGuitar" instrument presence. */
    bassGuitar?: Array<number> | undefined;
    /** Segments prediction value for the "woodwinds" instrument presence. */
    woodwinds?: Array<number> | undefined;
    /** Segments prediction value for the "brass" instrument presence. */
    brass?: Array<number> | undefined;
  };
  ['AudioAnalysisV7InstrumentTags']: AudioAnalysisV7InstrumentTags;
  /** The intensity of an instrument's presence throughout a track. */
  ['AudioAnalysisV7InstrumentPresence']: {
    /** Intensity of the percussion instrument. */
    percussion: ModelTypes['AudioAnalysisInstrumentPresenceLabel'];
    /** Intensity of the synthesizer instrument. */
    synth: ModelTypes['AudioAnalysisInstrumentPresenceLabel'];
    /** Intensity of the piano instrument. */
    piano: ModelTypes['AudioAnalysisInstrumentPresenceLabel'];
    /** Intensity of the acoustic guitar instrument. */
    acousticGuitar: ModelTypes['AudioAnalysisInstrumentPresenceLabel'];
    /** Intensity of the electric guitar instrument. */
    electricGuitar: ModelTypes['AudioAnalysisInstrumentPresenceLabel'];
    /** Intensity of the strings instrument. */
    strings: ModelTypes['AudioAnalysisInstrumentPresenceLabel'];
    /** Intensity of the bass instrument. */
    bass: ModelTypes['AudioAnalysisInstrumentPresenceLabel'];
    /** Intensity of the bass guitar instrument. */
    bassGuitar: ModelTypes['AudioAnalysisInstrumentPresenceLabel'];
    /** Intensity of the brass instrument. */
    brass?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    /** Intensity of the woodwinds instrument. */
    woodwinds?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
  };
  ['AudioAnalysisV7ExtendedInstrumentsSegments']: {
    acousticGuitar?: Array<number | undefined> | undefined;
    bass?: Array<number | undefined> | undefined;
    bassGuitar?: Array<number | undefined> | undefined;
    electricGuitar?: Array<number | undefined> | undefined;
    percussion?: Array<number | undefined> | undefined;
    piano?: Array<number | undefined> | undefined;
    synth?: Array<number | undefined> | undefined;
    strings?: Array<number | undefined> | undefined;
    brass?: Array<number | undefined> | undefined;
    woodwinds?: Array<number | undefined> | undefined;
    tuba?: Array<number | undefined> | undefined;
    frenchHorn?: Array<number | undefined> | undefined;
    oboe?: Array<number | undefined> | undefined;
    mandolin?: Array<number | undefined> | undefined;
    cello?: Array<number | undefined> | undefined;
    marimba?: Array<number | undefined> | undefined;
    vibraphone?: Array<number | undefined> | undefined;
    electricPiano?: Array<number | undefined> | undefined;
    electricOrgan?: Array<number | undefined> | undefined;
    harp?: Array<number | undefined> | undefined;
    ukulele?: Array<number | undefined> | undefined;
    harpsichord?: Array<number | undefined> | undefined;
    churchOrgan?: Array<number | undefined> | undefined;
    doubleBass?: Array<number | undefined> | undefined;
    xylophone?: Array<number | undefined> | undefined;
    glockenspiel?: Array<number | undefined> | undefined;
    electronicDrums?: Array<number | undefined> | undefined;
    drumKit?: Array<number | undefined> | undefined;
    accordion?: Array<number | undefined> | undefined;
    violin?: Array<number | undefined> | undefined;
    flute?: Array<number | undefined> | undefined;
    sax?: Array<number | undefined> | undefined;
    trumpet?: Array<number | undefined> | undefined;
    celeste?: Array<number | undefined> | undefined;
    pizzicato?: Array<number | undefined> | undefined;
    banjo?: Array<number | undefined> | undefined;
    clarinet?: Array<number | undefined> | undefined;
    bells?: Array<number | undefined> | undefined;
    steelDrums?: Array<number | undefined> | undefined;
    bongoConga?: Array<number | undefined> | undefined;
    africanPercussion?: Array<number | undefined> | undefined;
    tabla?: Array<number | undefined> | undefined;
    sitar?: Array<number | undefined> | undefined;
    taiko?: Array<number | undefined> | undefined;
    asianFlute?: Array<number | undefined> | undefined;
    asianStrings?: Array<number | undefined> | undefined;
    luteOud?: Array<number | undefined> | undefined;
  };
  ['AudioAnalysisV7ExtendedInstrumentTags']: AudioAnalysisV7ExtendedInstrumentTags;
  /** The intensity of an instrument's presence throughout a track. */
  ['AudioAnalysisV7ExtendedInstrumentPresence']: {
    acousticGuitar?:
      | ModelTypes['AudioAnalysisInstrumentPresenceLabel']
      | undefined;
    bass?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    bassGuitar?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    electricGuitar?:
      | ModelTypes['AudioAnalysisInstrumentPresenceLabel']
      | undefined;
    percussion?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    piano?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    synth?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    strings?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    brass?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    woodwinds?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    tuba?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    frenchHorn?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    oboe?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    mandolin?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    cello?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    marimba?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    vibraphone?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    electricPiano?:
      | ModelTypes['AudioAnalysisInstrumentPresenceLabel']
      | undefined;
    electricOrgan?:
      | ModelTypes['AudioAnalysisInstrumentPresenceLabel']
      | undefined;
    harp?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    ukulele?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    harpsichord?:
      | ModelTypes['AudioAnalysisInstrumentPresenceLabel']
      | undefined;
    churchOrgan?:
      | ModelTypes['AudioAnalysisInstrumentPresenceLabel']
      | undefined;
    doubleBass?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    xylophone?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    glockenspiel?:
      | ModelTypes['AudioAnalysisInstrumentPresenceLabel']
      | undefined;
    electronicDrums?:
      | ModelTypes['AudioAnalysisInstrumentPresenceLabel']
      | undefined;
    drumKit?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    accordion?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    violin?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    flute?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    sax?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    trumpet?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    celeste?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    pizzicato?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    banjo?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    clarinet?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    bells?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    steelDrums?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    bongoConga?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    africanPercussion?:
      | ModelTypes['AudioAnalysisInstrumentPresenceLabel']
      | undefined;
    tabla?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    sitar?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    taiko?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    asianFlute?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    asianStrings?:
      | ModelTypes['AudioAnalysisInstrumentPresenceLabel']
      | undefined;
    luteOud?: ModelTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
  };
  ['AudioAnalysisV7Genre']: {
    /** Mean prediction value for the "afro" genre. */
    afro?: number | undefined;
    /** Mean prediction value for the "ambient" genre. */
    ambient?: number | undefined;
    /** Mean prediction value for the "arab" genre. */
    arab?: number | undefined;
    /** Mean prediction value for the "asian" genre. */
    asian?: number | undefined;
    /** Mean prediction value for the "blues" genre. */
    blues?: number | undefined;
    /** Mean prediction value for the "children jingle" genre. */
    childrenJingle?: number | undefined;
    /** Mean prediction value for the "classical" genre. */
    classical?: number | undefined;
    /** Mean prediction value for the "electronic dance" genre. */
    electronicDance?: number | undefined;
    /** Mean prediction value for the "folk country" genre. */
    folkCountry?: number | undefined;
    /** Mean prediction value for the "funk soul" genre. */
    funkSoul?: number | undefined;
    /** Mean prediction value for the "indian" genre. */
    indian?: number | undefined;
    /** Mean prediction value for the "jazz" genre. */
    jazz?: number | undefined;
    /** Mean prediction value for the "latin" genre. */
    latin?: number | undefined;
    /** Mean prediction value for the "metal" genre. */
    metal?: number | undefined;
    /** Mean prediction value for the "pop" genre. */
    pop?: number | undefined;
    /** Mean prediction value for the "rap hip hop" genre. */
    rapHipHop?: number | undefined;
    /** Mean prediction value for the "reggae" genre. */
    reggae?: number | undefined;
    /** Mean prediction value for the "rnb" genre. */
    rnb?: number | undefined;
    /** Mean prediction value for the "rock" genre. */
    rock?: number | undefined;
    /** Mean prediction value for the "singer songwriters" genre. */
    singerSongwriters?: number | undefined;
    /** Mean prediction value for the "sound" genre. */
    sound?: number | undefined;
    /** Mean prediction value for the "soundtrack" genre. */
    soundtrack?: number | undefined;
    /** Mean prediction value for the "spoken word" genre. */
    spokenWord?: number | undefined;
  };
  ['AudioAnalysisV7GenreTags']: AudioAnalysisV7GenreTags;
  ['AudioAnalysisV7GenreSegments']: {
    /** Segments prediction value for the "afro" genre */
    afro: Array<number>;
    /** Segments prediction value for the "ambient" genre */
    ambient: Array<number>;
    /** Segments prediction value for the "arab" genre */
    arab: Array<number>;
    /** Segments prediction value for the "asian" genre */
    asian: Array<number>;
    /** Segments prediction value for the "blues" genre */
    blues: Array<number>;
    /** Segments prediction value for the "childrenJingle" genre */
    childrenJingle: Array<number>;
    /** Segments prediction value for the "classical" genre */
    classical: Array<number>;
    /** Segments prediction value for the "electronicDance" genre */
    electronicDance: Array<number>;
    /** Segments prediction value for the "folkCountry" genre */
    folkCountry: Array<number>;
    /** Segments prediction value for the "funkSoul" genre */
    funkSoul: Array<number>;
    /** Segments prediction value for the "indian" genre */
    indian: Array<number>;
    /** Segments prediction value for the "jazz" genre */
    jazz: Array<number>;
    /** Segments prediction value for the "latin" genre */
    latin: Array<number>;
    /** Segments prediction value for the "metal" genre */
    metal: Array<number>;
    /** Segments prediction value for the "pop" genre */
    pop: Array<number>;
    /** Segments prediction value for the "rapHipHop" genre */
    rapHipHop: Array<number>;
    /** Segments prediction value for the "reggae" genre */
    reggae: Array<number>;
    /** Segments prediction value for the "rnb" genre */
    rnb: Array<number>;
    /** Segments prediction value for the "rock" genre */
    rock: Array<number>;
    /** Segments prediction value for the "singerSongwriters" genre */
    singerSongwriters: Array<number>;
    /** Segments prediction value for the "sound" genre */
    sound: Array<number>;
    /** Segments prediction value for the "soundtrack" genre */
    soundtrack: Array<number>;
    /** Segments prediction value for the "spokenWord" genre */
    spokenWord: Array<number>;
  };
  ['AudioAnalysisV7SubgenreSegments']: {
    /** Segments prediction value for the "bluesRock" sub-genre. */
    bluesRock?: Array<number> | undefined;
    /** Segments prediction value for the "folkRock" sub-genre. */
    folkRock?: Array<number> | undefined;
    /** Segments prediction value for the "hardRock" sub-genre. */
    hardRock?: Array<number> | undefined;
    /** Segments prediction value for the "indieAlternative" sub-genre. */
    indieAlternative?: Array<number> | undefined;
    /** Segments prediction value for the "psychedelicProgressiveRock" sub-genre. */
    psychedelicProgressiveRock?: Array<number> | undefined;
    /** Segments prediction value for the "punk" sub-genre. */
    punk?: Array<number> | undefined;
    /** Segments prediction value for the "rockAndRoll" sub-genre. */
    rockAndRoll?: Array<number> | undefined;
    /** Segments prediction value for the "popSoftRock" sub-genre. */
    popSoftRock?: Array<number> | undefined;
    /** Segments prediction value for the "abstractIDMLeftfield" sub-genre. */
    abstractIDMLeftfield?: Array<number> | undefined;
    /** Segments prediction value for the "breakbeatDnB" sub-genre. */
    breakbeatDnB?: Array<number> | undefined;
    /** Segments prediction value for the "deepHouse" sub-genre. */
    deepHouse?: Array<number> | undefined;
    /** Segments prediction value for the "electro" sub-genre. */
    electro?: Array<number> | undefined;
    /** Segments prediction value for the "house" sub-genre. */
    house?: Array<number> | undefined;
    /** Segments prediction value for the "minimal" sub-genre. */
    minimal?: Array<number> | undefined;
    /** Segments prediction value for the "synthPop" sub-genre. */
    synthPop?: Array<number> | undefined;
    /** Segments prediction value for the "techHouse" sub-genre. */
    techHouse?: Array<number> | undefined;
    /** Segments prediction value for the "techno" sub-genre. */
    techno?: Array<number> | undefined;
    /** Segments prediction value for the "trance" sub-genre. */
    trance?: Array<number> | undefined;
    /** Segments prediction value for the "contemporaryRnB" sub-genre. */
    contemporaryRnB?: Array<number> | undefined;
    /** Segments prediction value for the "gangsta" sub-genre. */
    gangsta?: Array<number> | undefined;
    /** Segments prediction value for the "jazzyHipHop" sub-genre. */
    jazzyHipHop?: Array<number> | undefined;
    /** Segments prediction value for the "popRap" sub-genre. */
    popRap?: Array<number> | undefined;
    /** Segments prediction value for the "trap" sub-genre. */
    trap?: Array<number> | undefined;
    /** Segments prediction value for the "blackMetal" sub-genre. */
    blackMetal?: Array<number> | undefined;
    /** Segments prediction value for the "deathMetal" sub-genre. */
    deathMetal?: Array<number> | undefined;
    /** Segments prediction value for the "doomMetal" sub-genre. */
    doomMetal?: Array<number> | undefined;
    /** Segments prediction value for the "heavyMetal" sub-genre. */
    heavyMetal?: Array<number> | undefined;
    /** Segments prediction value for the "metalcore" sub-genre. */
    metalcore?: Array<number> | undefined;
    /** Segments prediction value for the "nuMetal" sub-genre. */
    nuMetal?: Array<number> | undefined;
    /** Segments prediction value for the "disco" sub-genre. */
    disco?: Array<number> | undefined;
    /** Segments prediction value for the "funk" sub-genre. */
    funk?: Array<number> | undefined;
    /** Segments prediction value for the "gospel" sub-genre. */
    gospel?: Array<number> | undefined;
    /** Segments prediction value for the "neoSoul" sub-genre. */
    neoSoul?: Array<number> | undefined;
    /** Segments prediction value for the "soul" sub-genre. */
    soul?: Array<number> | undefined;
    /** Segments prediction value for the "bigBandSwing" sub-genre. */
    bigBandSwing?: Array<number> | undefined;
    /** Segments prediction value for the "bebop" sub-genre. */
    bebop?: Array<number> | undefined;
    /** Segments prediction value for the "contemporaryJazz" sub-genre. */
    contemporaryJazz?: Array<number> | undefined;
    /** Segments prediction value for the "easyListening" sub-genre. */
    easyListening?: Array<number> | undefined;
    /** Segments prediction value for the "fusion" sub-genre. */
    fusion?: Array<number> | undefined;
    /** Segments prediction value for the "latinJazz" sub-genre. */
    latinJazz?: Array<number> | undefined;
    /** Segments prediction value for the "smoothJazz" sub-genre. */
    smoothJazz?: Array<number> | undefined;
    /** Segments prediction value for the "country" sub-genre. */
    country?: Array<number> | undefined;
    /** Segments prediction value for the "folk" sub-genre. */
    folk?: Array<number> | undefined;
  };
  ['AudioAnalysisV7SubgenreTags']: AudioAnalysisV7SubgenreTags;
  ['AudioAnalysisV7Subgenre']: {
    /** Mean prediction value for the "bluesRock" sub-genre. */
    bluesRock?: number | undefined;
    /** Mean prediction value for the "folkRock" sub-genre. */
    folkRock?: number | undefined;
    /** Mean prediction value for the "hardRock" sub-genre. */
    hardRock?: number | undefined;
    /** Mean prediction value for the "indieAlternative" sub-genre. */
    indieAlternative?: number | undefined;
    /** Mean prediction value for the "psychedelicProgressiveRock" sub-genre. */
    psychedelicProgressiveRock?: number | undefined;
    /** Mean prediction value for the "punk" sub-genre. */
    punk?: number | undefined;
    /** Mean prediction value for the "rockAndRoll" sub-genre. */
    rockAndRoll?: number | undefined;
    /** Mean prediction value for the "popSoftRock" sub-genre. */
    popSoftRock?: number | undefined;
    /** Mean prediction value for the "abstractIDMLeftfield" sub-genre. */
    abstractIDMLeftfield?: number | undefined;
    /** Mean prediction value for the "breakbeatDnB" sub-genre. */
    breakbeatDnB?: number | undefined;
    /** Mean prediction value for the "deepHouse" sub-genre. */
    deepHouse?: number | undefined;
    /** Mean prediction value for the "electro" sub-genre. */
    electro?: number | undefined;
    /** Mean prediction value for the "house" sub-genre. */
    house?: number | undefined;
    /** Mean prediction value for the "minimal" sub-genre. */
    minimal?: number | undefined;
    /** Mean prediction value for the "synthPop" sub-genre. */
    synthPop?: number | undefined;
    /** Mean prediction value for the "techHouse" sub-genre. */
    techHouse?: number | undefined;
    /** Mean prediction value for the "techno" sub-genre. */
    techno?: number | undefined;
    /** Mean prediction value for the "trance" sub-genre. */
    trance?: number | undefined;
    /** Mean prediction value for the "contemporaryRnB" sub-genre. */
    contemporaryRnB?: number | undefined;
    /** Mean prediction value for the "gangsta" sub-genre. */
    gangsta?: number | undefined;
    /** Mean prediction value for the "jazzyHipHop" sub-genre. */
    jazzyHipHop?: number | undefined;
    /** Mean prediction value for the "popRap" sub-genre. */
    popRap?: number | undefined;
    /** Mean prediction value for the "trap" sub-genre. */
    trap?: number | undefined;
    /** Mean prediction value for the "blackMetal" sub-genre. */
    blackMetal?: number | undefined;
    /** Mean prediction value for the "deathMetal" sub-genre. */
    deathMetal?: number | undefined;
    /** Mean prediction value for the "doomMetal" sub-genre. */
    doomMetal?: number | undefined;
    /** Mean prediction value for the "heavyMetal" sub-genre. */
    heavyMetal?: number | undefined;
    /** Mean prediction value for the "metalcore" sub-genre. */
    metalcore?: number | undefined;
    /** Mean prediction value for the "nuMetal" sub-genre. */
    nuMetal?: number | undefined;
    /** Mean prediction value for the "disco" sub-genre. */
    disco?: number | undefined;
    /** Mean prediction value for the "funk" sub-genre. */
    funk?: number | undefined;
    /** Mean prediction value for the "gospel" sub-genre. */
    gospel?: number | undefined;
    /** Mean prediction value for the "neoSoul" sub-genre. */
    neoSoul?: number | undefined;
    /** Mean prediction value for the "soul" sub-genre. */
    soul?: number | undefined;
    /** Mean prediction value for the "bigBandSwing" sub-genre. */
    bigBandSwing?: number | undefined;
    /** Mean prediction value for the "bebop" sub-genre. */
    bebop?: number | undefined;
    /** Mean prediction value for the "contemporaryJazz" sub-genre. */
    contemporaryJazz?: number | undefined;
    /** Mean prediction value for the "easyListening" sub-genre. */
    easyListening?: number | undefined;
    /** Mean prediction value for the "fusion" sub-genre. */
    fusion?: number | undefined;
    /** Mean prediction value for the "latinJazz" sub-genre. */
    latinJazz?: number | undefined;
    /** Mean prediction value for the "smoothJazz" sub-genre. */
    smoothJazz?: number | undefined;
    /** Mean prediction value for the "country" sub-genre. */
    country?: number | undefined;
    /** Mean prediction value for the "folk" sub-genre. */
    folk?: number | undefined;
  };
  ['AudioAnalysisV6Result']: {
    /** The prediction results for the segments of the audio. */
    segments?: ModelTypes['AudioAnalysisV6Segments'] | undefined;
    /** The multi-label genre prediction for the whole audio. */
    genre?: ModelTypes['AudioAnalysisV6Genre'] | undefined;
    genreTags?: Array<ModelTypes['AudioAnalysisV6GenreTags']> | undefined;
    /** The multi-label subgenre prediction for the whole audio. */
    subgenre?: ModelTypes['AudioAnalysisV6Subgenre'] | undefined;
    /** List of subgenre tags the audio is classified with. */
    subgenreTags?: Array<ModelTypes['AudioAnalysisV6SubgenreTags']> | undefined;
    subgenreEdm?: ModelTypes['AudioAnalysisV6SubgenreEdm'] | undefined;
    subgenreEdmTags?:
      | Array<ModelTypes['AudioAnalysisV6SubgenreEdmTags']>
      | undefined;
    /** The multi-label mood prediction for the whole audio. */
    mood?: ModelTypes['AudioAnalysisV6Mood'] | undefined;
    /** List of mood tags the audio is classified with. */
    moodTags?: Array<ModelTypes['AudioAnalysisV6MoodTags']> | undefined;
    moodMaxTimes?:
      | Array<ModelTypes['AudioAnalysisV6MaximumMoodInterval']>
      | undefined;
    voice?: ModelTypes['AudioAnalysisV6Voice'] | undefined;
    instruments?: ModelTypes['AudioAnalysisV6Instruments'] | undefined;
    /** The presence of instruments of the audio. */
    instrumentPresence?:
      | ModelTypes['AudioAnalysisV6InstrumentPresence']
      | undefined;
    /** List of instrument tags the audio is classified with. */
    instrumentTags?:
      | Array<ModelTypes['AudioAnalysisV6InstrumentTags']>
      | undefined;
    /** BPM of the track. */
    bpm?: number | undefined;
    /** BPM predicted for the track. */
    bpmPrediction?: ModelTypes['AudioAnalysisV6BPMPrediction'] | undefined;
    /** The global estimated bpm value of the full track fixed to a custom range of 60-180 bpm. */
    bpmRangeAdjusted?: number | undefined;
    /** The key predicted for the track. */
    key?: ModelTypes['MusicalKey'] | undefined;
    /** The key predicted for the track. */
    keyPrediction?: ModelTypes['AudioAnalysisV6KeyPrediction'] | undefined;
    /** Time signature of the track. */
    timeSignature?: string | undefined;
    /** The overall valance of the audio. */
    valence?: number | undefined;
    /** The overall arousal of the audio. */
    arousal?: number | undefined;
    /** The overall energy level of the audio. */
    energyLevel?: ModelTypes['AudioAnalysisV6EnergyLevel'] | undefined;
    /** The overall energy dynamics of the audio. */
    energyDynamics?: ModelTypes['AudioAnalysisV6EnergyDynamics'] | undefined;
    /** The overall emotional profile of the audio. */
    emotionalProfile?:
      | ModelTypes['AudioAnalysisV6EmotionalProfile']
      | undefined;
    /** The overall voice presence profile of the audio. */
    voicePresenceProfile?:
      | ModelTypes['AudioAnalysisV6VoicePresenceProfile']
      | undefined;
    /** The overall emotional dynamics of the audio. */
    emotionalDynamics?:
      | ModelTypes['AudioAnalysisV6EmotionalDynamics']
      | undefined;
    /** The predominant voice gender of the audio. */
    predominantVoiceGender?:
      | ModelTypes['AudioAnalysisV6PredominantVoiceGender']
      | undefined;
    /** The predicted musical era of the audio. */
    musicalEraTag?: string | undefined;
    voiceTags?: Array<ModelTypes['AudioAnalysisV6VoiceTags']> | undefined;
    moodAdvanced?: ModelTypes['AudioAnalysisV6MoodAdvanced'] | undefined;
    moodAdvancedTags?:
      | Array<ModelTypes['AudioAnalysisV6MoodAdvancedTags']>
      | undefined;
    movement?: ModelTypes['AudioAnalysisV6Movement'] | undefined;
    movementTags?: Array<ModelTypes['AudioAnalysisV6MovementTags']> | undefined;
    character?: ModelTypes['AudioAnalysisV6Character'] | undefined;
    characterTags?:
      | Array<ModelTypes['AudioAnalysisV6CharacterTags']>
      | undefined;
    /** This field is only available for music classified as classical. */
    classicalEpoch?: ModelTypes['AudioAnalysisV6ClassicalEpoch'] | undefined;
    /** This field is only available for music classified as classical. */
    classicalEpochTags?:
      | Array<ModelTypes['AudioAnalysisV6ClassicalEpochTags']>
      | undefined;
    transformerCaption?: string | undefined;
    /** The multi-label genre prediction for the whole audio. */
    advancedGenre?: ModelTypes['AudioAnalysisV7Genre'] | undefined;
    advancedGenreTags?:
      | Array<ModelTypes['AudioAnalysisV7GenreTags']>
      | undefined;
    /** The multi-label subgenre prediction for the whole audio. */
    advancedSubgenre?: ModelTypes['AudioAnalysisV7Subgenre'] | undefined;
    /** List of subgenre tags the audio is classified with. */
    advancedSubgenreTags?:
      | Array<ModelTypes['AudioAnalysisV7SubgenreTags']>
      | undefined;
    /** The presence of instruments of the audio. */
    advancedInstrumentPresence?:
      | ModelTypes['AudioAnalysisV7InstrumentPresence']
      | undefined;
    /** List of instrument tags the audio is classified with. */
    advancedInstrumentTags?:
      | Array<ModelTypes['AudioAnalysisV7InstrumentTags']>
      | undefined;
    /** The presence of instruments of the audio. */
    advancedInstrumentPresenceExtended?:
      | ModelTypes['AudioAnalysisV7ExtendedInstrumentPresence']
      | undefined;
    /** List of instrument tags the audio is classified with. */
    advancedInstrumentTagsExtended?:
      | Array<ModelTypes['AudioAnalysisV7ExtendedInstrumentTags']>
      | undefined;
    /** The existence of the voiceover in this track */
    voiceoverExists?: boolean | undefined;
    /** The degree of certainty that there is a voiceover */
    voiceoverDegree?: number | undefined;
    freeGenreTags?: string | undefined;
  };
  ['LibraryTrack']: {
    audioAnalysisV6: ModelTypes['AudioAnalysisV6'];
    /** The primary identifier. */
    id: string;
    /** The title of the track.
Can be specified when creating the track. */
    title: string;
    /** An optional external identifier
Can be specified when creating the track. */
    externalId?: string | undefined;
    /** Similar tracks from the own library. */
    similarLibraryTracks: ModelTypes['SimilarLibraryTracksResult'];
    /** Find similar tracks. */
    similarTracks: ModelTypes['SimilarTracksResult'];
    /** Augmented keywords that can be associated with the audio. */
    augmentedKeywords: ModelTypes['AugmentedKeywordsResult'];
    /** Brand values that can be associated with the audio. */
    brandValues: ModelTypes['BrandValuesResult'];
  };
  /** Represents a track on Spotify. */
  ['SpotifyTrack']: {
    audioAnalysisV6: ModelTypes['AudioAnalysisV6'];
    /** The ID of the track on Spotify. It can be used for fetching additional information for the Spotify API.
For further information check out the Spotify Web API Documentation. https://developer.spotify.com/documentation/web-api/ */
    id: string;
    title: string;
    /** Find similar tracks. */
    similarTracks: ModelTypes['SimilarTracksResult'];
    /** Augmented keywords that can be associated with the audio. */
    augmentedKeywords: ModelTypes['AugmentedKeywordsResult'];
    /** Brand values that can be associated with the audio. */
    brandValues: ModelTypes['BrandValuesResult'];
  };
  ['LibraryTrackNotFoundError']: {
    message: string;
  };
  ['LibraryTrackResult']:
    | ModelTypes['LibraryTrackNotFoundError']
    | ModelTypes['LibraryTrack'];
  ['LibraryTrackEdge']: {
    cursor: string;
    node: ModelTypes['LibraryTrack'];
  };
  ['LibraryTrackConnection']: {
    edges: Array<ModelTypes['LibraryTrackEdge']>;
    pageInfo: ModelTypes['PageInfo'];
  };
  ['SimilarLibraryTracksErrorCode']: SimilarLibraryTracksErrorCode;
  /** An error object returned if an error occurred while retrieving similar tracks. */
  ['SimilarLibraryTracksError']: {
    message: string;
    code: ModelTypes['SimilarLibraryTracksErrorCode'];
  };
  /** Describes the possible types the 'LibraryTrack.similarLibraryTracks' field can return. */
  ['SimilarLibraryTracksResult']:
    | ModelTypes['SimilarLibraryTracksError']
    | ModelTypes['SimilarLibraryTrackConnection'];
  /** Filter the LibraryTrackConnection. @oneOf */
  ['LibraryTracksFilter']: {
    /** Find library tracks whose title includes a specific substring. */
    title?: string | undefined;
    /** Find library tracks whose source audio file sha256 hash matches. */
    sha256?: string | undefined;
    /** Find library tracks whose external id matches. */
    externalId?: string | undefined;
  };
  ['CratesConnection']: {
    edges: Array<ModelTypes['CrateEdge']>;
    pageInfo: ModelTypes['PageInfo'];
  };
  ['CrateEdge']: {
    cursor: string;
    node: ModelTypes['Crate'];
  };
  /** A type representing a crate on the Cyanite platform. */
  ['Crate']: {
    id: string;
    name: string;
  };
  ['CrateCreateErrorCode']: CrateCreateErrorCode;
  /** An error object returned if an error occurred while creating a crate. */
  ['CrateCreateError']: {
    message: string;
    code: ModelTypes['CrateCreateErrorCode'];
  };
  /** Input for 'crateDelete' Mutation. */
  ['CrateDeleteInput']: {
    /** Id of the crate that will be deleted. */
    id: string;
  };
  /** Input for 'crateCreate' Mutation. */
  ['CrateCreateInput']: {
    /** The name of the crate to be created. */
    name: string;
  };
  /** Input for 'crateAddLibraryTracks' Mutation. */
  ['CrateAddLibraryTracksInput']: {
    /** Tracks that will be put into the crate. */
    libraryTrackIds: Array<string>;
    /** Target crate id. */
    crateId: string;
  };
  /** Input for 'crateRemoveLibraryTracks' Mutation. */
  ['CrateRemoveLibraryTracksInput']: {
    /** Tracks that will be removed from the crate. */
    libraryTrackIds: Array<string>;
    /** Target crate id. */
    crateId: string;
  };
  /** Describes the possible types that the 'crateCreate' Mutation can return. */
  ['CrateCreateResult']:
    | ModelTypes['CrateCreateSuccess']
    | ModelTypes['CrateCreateError'];
  /** The crate was created successfully. */
  ['CrateCreateSuccess']: {
    /** Id of the newly created crate. */
    id: string;
  };
  /** Describes the possible types that the 'crateDelete' Mutation can return. */
  ['CrateDeleteResult']:
    | ModelTypes['CrateDeleteSuccess']
    | ModelTypes['CrateDeleteError'];
  /** The crate was deleted successfully. */
  ['CrateDeleteSuccess']: {
    _?: boolean | undefined;
  };
  ['CrateDeleteErrorCode']: CrateDeleteErrorCode;
  /** An error object returned if an error occurred while deleting a crate. */
  ['CrateDeleteError']: {
    message: string;
    code: ModelTypes['CrateDeleteErrorCode'];
  };
  /** Describes the possible types that the 'crateAddLibraryTracks' Mutation can return. */
  ['CrateAddLibraryTracksResult']:
    | ModelTypes['CrateAddLibraryTracksSuccess']
    | ModelTypes['CrateAddLibraryTracksError'];
  /** The tracks were successfully added to the crate. */
  ['CrateAddLibraryTracksSuccess']: {
    /** The IDs of the library tracks that were added to the crate. */
    addedLibraryTrackIds: Array<string>;
  };
  /** An error object returned if an error occurred while adding the tracks to the crate. */
  ['CrateAddLibraryTracksError']: {
    message: string;
    code: ModelTypes['CrateAddLibraryTracksErrorCode'];
  };
  ['CrateAddLibraryTracksErrorCode']: CrateAddLibraryTracksErrorCode;
  /** Describes the possible types that the 'crateRemoveLibraryTracks' Mutation can return. */
  ['CrateRemoveLibraryTracksResult']:
    | ModelTypes['CrateRemoveLibraryTracksSuccess']
    | ModelTypes['CrateRemoveLibraryTracksError'];
  /** The tracks were successfully removed from the crate. */
  ['CrateRemoveLibraryTracksSuccess']: {
    /** The IDs of the library tracks that were removed from the crate. */
    removedLibraryTrackIds: Array<string>;
  };
  /** Error codes that can be returned by the 'crateRemoveLibraryTracks' Mutation. */
  ['CrateRemoveLibraryTracksError']: {
    message: string;
    code: ModelTypes['CrateRemoveLibraryTracksErrorCode'];
  };
  ['CrateRemoveLibraryTracksErrorCode']: CrateRemoveLibraryTracksErrorCode;
  ['LibraryTrackCreateInput']: {
    /** The id of the upload requested via the 'fileUploadRequest' Mutation. */
    uploadId: string;
    /** An optional title that is set for the 'LibraryTrack'.
The character limit for the title is 150. */
    title?: string | undefined;
    /** An optional external identifier that is set for the 'LibraryTrack'.
The character limit for the external id is 150. */
    externalId?: string | undefined;
  };
  /** Describes a successful LibraryTrack creation. */
  ['LibraryTrackCreateSuccess']: {
    /** The newly created LibraryTrack. */
    createdLibraryTrack: ModelTypes['LibraryTrack'];
    /** Whether the track was enqueued successfully or not. */
    enqueueResult: ModelTypes['LibraryTrackEnqueueResult'];
  };
  ['LibraryTrackCreateErrorCode']: LibraryTrackCreateErrorCode;
  /** Describes a failed LibraryTrack creation. */
  ['LibraryTrackCreateError']: {
    /** An error that describes the reason for the failed LibraryTrack creation. */
    code: ModelTypes['LibraryTrackCreateErrorCode'];
    /** A human readable message that describes the reason for the failed LibraryTrack creation. */
    message: string;
  };
  /** Describes the possible types the 'libraryTrackCreate' Mutation can return. */
  ['LibraryTrackCreateResult']:
    | ModelTypes['LibraryTrackCreateSuccess']
    | ModelTypes['LibraryTrackCreateError'];
  ['LibraryTrackEnqueueSuccess']: {
    enqueuedLibraryTrack: ModelTypes['LibraryTrack'];
  };
  ['LibraryTrackEnqueueErrorCode']: LibraryTrackEnqueueErrorCode;
  ['LibraryTrackEnqueueError']: {
    /** An error that describes the reason for the failed LibraryTrack creation. */
    code: ModelTypes['LibraryTrackEnqueueErrorCode'];
    /** A human readable message that describes the reason for the failed LibraryTrack creation. */
    message: string;
  };
  ['LibraryTrackEnqueueResult']:
    | ModelTypes['LibraryTrackEnqueueSuccess']
    | ModelTypes['LibraryTrackEnqueueError'];
  ['LibraryTrackEnqueueInput']: {
    /** The id of the LibraryTrack that should be enqueued. */
    libraryTrackId: string;
  };
  /** Describes the possible types the 'libraryTracksDelete' Mutation can return. */
  ['LibraryTracksDeleteResult']:
    | ModelTypes['LibraryTracksDeleteSuccess']
    | ModelTypes['LibraryTracksDeleteError'];
  ['LibraryTracksDeleteErrorCode']: LibraryTracksDeleteErrorCode;
  ['LibraryTracksDeleteError']: {
    /** Error code. */
    code: ModelTypes['LibraryTracksDeleteErrorCode'];
    /** A human readable message that describes why the operation has failed. */
    message: string;
  };
  ['LibraryTracksDeleteSuccess']: {
    /** The IDs of deleted LibraryTracks. */
    libraryTrackIds: Array<string>;
  };
  ['LibraryTracksDeleteInput']: {
    /** The IDs of the LibraryTracks that should be deleted. */
    libraryTrackIds: Array<string>;
  };
  ['YouTubeTrackEnqueueResult']:
    | ModelTypes['YouTubeTrackEnqueueError']
    | ModelTypes['YouTubeTrackEnqueueSuccess'];
  ['YouTubeTrackEnqueueErrorCode']: YouTubeTrackEnqueueErrorCode;
  ['YouTubeTrackEnqueueError']: {
    /** A human readable message that describes why the operation has failed. */
    message: string;
    /** Error code if applicable */
    code: ModelTypes['YouTubeTrackEnqueueErrorCode'];
  };
  ['YouTubeTrackEnqueueSuccess']: {
    enqueuedLibraryTrack: ModelTypes['LibraryTrack'];
  };
  ['YouTubeTrackEnqueueInput']: {
    /** YouTube video URL */
    videoUrl: string;
  };
  ['SpotifyTrackError']: {
    message: string;
  };
  ['SpotifyTrackResult']:
    | ModelTypes['SpotifyTrackError']
    | ModelTypes['SpotifyTrack'];
  ['SpotifyTrackEnqueueInput']: {
    spotifyTrackId: string;
  };
  ['SpotifyTrackEnqueueError']: {
    message: string;
  };
  ['SpotifyTrackEnqueueSuccess']: {
    enqueuedSpotifyTrack: ModelTypes['SpotifyTrack'];
  };
  ['SpotifyTrackEnqueueResult']:
    | ModelTypes['SpotifyTrackEnqueueError']
    | ModelTypes['SpotifyTrackEnqueueSuccess'];
  ['SimilarTracksErrorCode']: SimilarTracksErrorCode;
  /** An error object returned if an error occurred while performing a similarity search. */
  ['SimilarTracksError']: {
    code: ModelTypes['SimilarTracksErrorCode'];
    message: string;
  };
  ['SimilarTracksEdge']: {
    cursor: string;
    node: ModelTypes['Track'];
  };
  ['SimilarTracksConnection']: {
    pageInfo: ModelTypes['PageInfo'];
    edges: Array<ModelTypes['SimilarTracksEdge']>;
  };
  /** Describes the possible types that the 'Track.similarTracks' field can return. */
  ['SimilarTracksResult']:
    | ModelTypes['SimilarTracksError']
    | ModelTypes['SimilarTracksConnection'];
  ['MusicalKey']: MusicalKey;
  ['MusicalGenre']: MusicalGenre;
  ['SimilarTracksSearchModeInterval']: {
    /** Start of the interval in seconds. */
    start: number;
    /** End of the interval in seconds. */
    end: number;
  };
  /** The search mode used for the similarity search.
Only one of the fields of this input type should be provided.
By default the 'mostRepresentative' mode will be used.

@oneOf */
  ['SimilarTracksSearchMode']: {
    /** Use the part of the track that is most representative as the criteria for finding similar tracks (Default mode). */
    mostRepresentative?: boolean | undefined;
    /** Use the complete track as the criteria for finding similar tracks. */
    complete?: boolean | undefined;
    /** Use the part of the track specified by the interval as the criteria for finding similar tracks. */
    interval?: ModelTypes['SimilarTracksSearchModeInterval'] | undefined;
  };
  /** Return similar tracks from a library. */
  ['SimilarTracksTargetLibrary']: {
    _?: boolean | undefined;
  };
  /** Return similar tracks from Spotify. */
  ['SimilarTracksTargetSpotify']: {
    _?: boolean | undefined;
  };
  /** Return similar tracks from a crate. */
  ['SimilarTracksTargetCrate']: {
    /** The crate id from which similar tracks should be returned. */
    crateId: string;
  };
  /** SimilarTracksTarget
Only one of the fields of this input type should be provided.
@oneOf */
  ['SimilarTracksTarget']: {
    /** Return LibraryTrack results. */
    library?: ModelTypes['SimilarTracksTargetLibrary'] | undefined;
    /** Return LibraryTracks from a specific crate. */
    crate?: ModelTypes['SimilarTracksTargetCrate'] | undefined;
    /** Return SpotifyTrack results. */
    spotify?: ModelTypes['SimilarTracksTargetSpotify'] | undefined;
  };
  ['experimental_SimilarTracksFilterBpmInput']: {
    _?: boolean | undefined;
  };
  ['experimental_SimilarTracksFilterBpmRange']: {
    start: number;
    end: number;
  };
  /** The BPM filter config.
Only one of the fields of this input type should be provided.
@oneOf */
  ['experimental_SimilarTracksFilterBpm']: {
    /** Use a BPM range around the input track (+-6%) */
    input?: ModelTypes['experimental_SimilarTracksFilterBpmInput'] | undefined;
    /** Use a custom BPM range */
    range?: ModelTypes['experimental_SimilarTracksFilterBpmRange'] | undefined;
  };
  ['experimental_SimilarTracksFilterGenreInput']: {
    _?: boolean | undefined;
  };
  /** The Genre filter config.
Only one of the fields of this input type should be provided.
@oneOf */
  ['experimental_SimilarTracksFilterGenre']: {
    /** Use a genre from the input track */
    input?:
      | ModelTypes['experimental_SimilarTracksFilterGenreInput']
      | undefined;
    /** Use a list of genres to filter for */
    list?: Array<ModelTypes['MusicalGenre']> | undefined;
  };
  ['experimental_SimilarTracksFilterKeyCamelotInput']: {
    _?: boolean | undefined;
  };
  /** The Camelot key filter config.
Only one of the fields of this input type should be provided.
SimilarTracksKeyFilter @oneOf */
  ['experimental_SimilarTracksFilterKeyCamelot']: {
    /** Use key from the input track. */
    input?:
      | ModelTypes['experimental_SimilarTracksFilterKeyCamelotInput']
      | undefined;
    /** Use custom key. */
    key?: ModelTypes['MusicalKey'] | undefined;
  };
  ['experimental_SimilarTracksFilterKeyMatchingInput']: {
    _?: boolean | undefined;
  };
  /** The key key filter config.
Only one of the fields of this input type should be provided.
SimilarTracksKeyFilter @oneOf */
  ['experimental_SimilarTracksFilterKeyMatching']: {
    /** Use key from the input track. */
    input?:
      | ModelTypes['experimental_SimilarTracksFilterKeyMatchingInput']
      | undefined;
    /** Use list of custom keys. */
    list?: Array<ModelTypes['MusicalKey']> | undefined;
  };
  /** The Key filter config.
Only one of the fields of this input type should be provided.
@oneOf */
  ['experimental_SimilarTracksFilterKey']: {
    /** When set, will use Camelot filtering. */
    camelot?:
      | ModelTypes['experimental_SimilarTracksFilterKeyCamelot']
      | undefined;
    /** When set, will use key filtering. */
    matching?:
      | ModelTypes['experimental_SimilarTracksFilterKeyMatching']
      | undefined;
  };
  /** Describes the possible filters that can be applied for the search. */
  ['experimental_SimilarTracksFilter']: {
    /** Filter the search results by a BPM range. */
    bpm?: ModelTypes['experimental_SimilarTracksFilterBpm'] | undefined;
    /** Filter the search results by a list of genres. */
    genre?: ModelTypes['experimental_SimilarTracksFilterGenre'] | undefined;
    /** Filter the search results by one of the possible key filters.
Default: no key filter applied */
    key?: ModelTypes['experimental_SimilarTracksFilterKey'] | undefined;
  };
  ['KeywordSearchKeyword']: {
    weight: number;
    keyword: string;
  };
  ['KeywordSearchErrorCode']: KeywordSearchErrorCode;
  ['KeywordSearchError']: {
    message: string;
    code: ModelTypes['KeywordSearchErrorCode'];
  };
  ['KeywordSearchResult']:
    | ModelTypes['KeywordSearchConnection']
    | ModelTypes['KeywordSearchError'];
  ['Keyword']: {
    keyword: string;
  };
  ['KeywordEdge']: {
    node: ModelTypes['Keyword'];
    cursor: string;
  };
  ['KeywordConnection']: {
    pageInfo: ModelTypes['PageInfo'];
    edges: Array<ModelTypes['KeywordEdge']>;
  };
  /** Return tracks from a library. */
  ['KeywordSearchTargetLibrary']: {
    _?: boolean | undefined;
  };
  /** Return tracks from a crate. */
  ['KeywordSearchTargetCrate']: {
    /** The crate id from which tracks should be returned. */
    crateId: string;
  };
  /** Return similar tracks from Spotify. */
  ['KeywordSearchTargetSpotify']: {
    _?: boolean | undefined;
  };
  /** KeywordSearchTarget
Only one of the fields of this input type should be provided.
@oneOf */
  ['KeywordSearchTarget']: {
    /** Return LibraryTrack results. */
    library?: ModelTypes['KeywordSearchTargetLibrary'] | undefined;
    /** Return LibraryTracks from a specific crate. */
    crate?: ModelTypes['KeywordSearchTargetCrate'] | undefined;
    /** Return SpotifyTrack results. */
    spotify?: ModelTypes['KeywordSearchTargetSpotify'] | undefined;
  };
  ['KeywordSearchEdge']: {
    node: ModelTypes['Track'];
    cursor: string;
  };
  ['KeywordSearchConnection']: {
    pageInfo: ModelTypes['PageInfo'];
    edges: Array<ModelTypes['KeywordSearchEdge']>;
  };
  ['AugmentedKeyword']: {
    keyword: string;
    weight: number;
  };
  ['AugmentedKeywords']: {
    keywords: Array<ModelTypes['AugmentedKeyword']>;
  };
  ['AugmentedKeywordsErrorCode']: AugmentedKeywordsErrorCode;
  ['AugmentedKeywordsError']: {
    message: string;
    code: ModelTypes['AugmentedKeywordsErrorCode'];
  };
  ['AugmentedKeywordsResult']:
    | ModelTypes['AugmentedKeywordsError']
    | ModelTypes['AugmentedKeywords'];
  ['BrandValuesSuccess']: {
    values: Array<string>;
  };
  ['SelectBrandValuesInput']: {
    /** Values must comply with available brand values */
    values: Array<string>;
  };
  ['SelectBrandValuesSuccess']: {
    success: boolean;
  };
  ['SelectBrandValuesResult']:
    | ModelTypes['BrandValuesError']
    | ModelTypes['SelectBrandValuesSuccess'];
  ['BrandValuesResult']:
    | ModelTypes['BrandValuesError']
    | ModelTypes['BrandValuesSuccess']
    | ModelTypes['BrandValues'];
  ['BrandValue']: {
    value: string;
    weight: number;
  };
  ['BrandValues']: {
    values: Array<ModelTypes['BrandValue']>;
  };
  ['BrandValuesErrorCode']: BrandValuesErrorCode;
  ['BrandValuesError']: {
    message: string;
    code: ModelTypes['BrandValuesErrorCode'];
  };
  ['FreeTextSearchErrorCode']: FreeTextSearchErrorCode;
  ['FreeTextSearchTargetLibrary']: {
    libraryUserId?: string | undefined;
  };
  ['FreeTextSearchTargetCrate']: {
    crateId: string;
  };
  ['FreeTextSearchTargetSpotify']: {
    _?: boolean | undefined;
  };
  ['FreeTextSearchTarget']: {
    library?: ModelTypes['FreeTextSearchTargetLibrary'] | undefined;
    crate?: ModelTypes['FreeTextSearchTargetCrate'] | undefined;
    spotify?: ModelTypes['FreeTextSearchTargetSpotify'] | undefined;
  };
  ['FreeTextSearchError']: {
    code: ModelTypes['FreeTextSearchErrorCode'];
    message: string;
  };
  ['FreeTextSearchEdge']: {
    cursor: string;
    node: ModelTypes['Track'];
  };
  ['FreeTextSearchConnection']: {
    pageInfo: ModelTypes['PageInfo'];
    edges: Array<ModelTypes['FreeTextSearchEdge']>;
  };
  /** Describes the possible types that the 'freeTextSearch' field can return. */
  ['FreeTextSearchResult']:
    | ModelTypes['FreeTextSearchError']
    | ModelTypes['FreeTextSearchConnection'];
  ['LyricsSearchErrorCode']: LyricsSearchErrorCode;
  /** The Spotify target for lyrics search */
  ['LyricsSearchTargetSpotify']: {
    _?: boolean | undefined;
  };
  /** Search target to perform the lyrics search on. Currently only Spotify is available. */
  ['LyricsSearchTarget']: {
    spotify?: ModelTypes['LyricsSearchTargetSpotify'] | undefined;
  };
  /** Error type if search cannot be performed. Contains the code and a message. */
  ['LyricsSearchError']: {
    code: ModelTypes['LyricsSearchErrorCode'];
    message: string;
  };
  /** The edge for lyrics search for cursor based pagination. */
  ['LyricsSearchEdge']: {
    cursor: string;
    node: ModelTypes['Track'];
  };
  /** The connection for lyrics search for cursor based pagination. */
  ['LyricsSearchConnection']: {
    pageInfo: ModelTypes['PageInfo'];
    edges: Array<ModelTypes['LyricsSearchEdge']>;
  };
  /** Describes the possible types that the 'lyricsSearch' field can return. */
  ['LyricsSearchResult']:
    | ModelTypes['LyricsSearchError']
    | ModelTypes['LyricsSearchConnection'];
  ['schema']: {
    query?: ModelTypes['Query'] | undefined;
    mutation?: ModelTypes['Mutation'] | undefined;
    subscription?: ModelTypes['Subscription'] | undefined;
  };
};

export type GraphQLTypes = {
  ['Error']: {
    __typename:
      | 'NoSimilarSpotifyTracksAvailableError'
      | 'SpotifySimilarLibraryTracksError'
      | 'SpotifyTrackNotFoundError'
      | 'SpotifyTrackWithoutPreviewUrlError'
      | 'AudioAnalysisV6Error'
      | 'LibraryTrackNotFoundError'
      | 'SimilarLibraryTracksError'
      | 'CrateCreateError'
      | 'CrateDeleteError'
      | 'CrateAddLibraryTracksError'
      | 'CrateRemoveLibraryTracksError'
      | 'LibraryTrackCreateError'
      | 'LibraryTrackEnqueueError'
      | 'LibraryTracksDeleteError'
      | 'SpotifyTrackError'
      | 'SpotifyTrackEnqueueError'
      | 'SimilarTracksError'
      | 'KeywordSearchError'
      | 'AugmentedKeywordsError'
      | 'BrandValuesError'
      | 'FreeTextSearchError'
      | 'LyricsSearchError';
    message: string;
    ['...on NoSimilarSpotifyTracksAvailableError']: '__union' &
      GraphQLTypes['NoSimilarSpotifyTracksAvailableError'];
    ['...on SpotifySimilarLibraryTracksError']: '__union' &
      GraphQLTypes['SpotifySimilarLibraryTracksError'];
    ['...on SpotifyTrackNotFoundError']: '__union' &
      GraphQLTypes['SpotifyTrackNotFoundError'];
    ['...on SpotifyTrackWithoutPreviewUrlError']: '__union' &
      GraphQLTypes['SpotifyTrackWithoutPreviewUrlError'];
    ['...on AudioAnalysisV6Error']: '__union' &
      GraphQLTypes['AudioAnalysisV6Error'];
    ['...on LibraryTrackNotFoundError']: '__union' &
      GraphQLTypes['LibraryTrackNotFoundError'];
    ['...on SimilarLibraryTracksError']: '__union' &
      GraphQLTypes['SimilarLibraryTracksError'];
    ['...on CrateCreateError']: '__union' & GraphQLTypes['CrateCreateError'];
    ['...on CrateDeleteError']: '__union' & GraphQLTypes['CrateDeleteError'];
    ['...on CrateAddLibraryTracksError']: '__union' &
      GraphQLTypes['CrateAddLibraryTracksError'];
    ['...on CrateRemoveLibraryTracksError']: '__union' &
      GraphQLTypes['CrateRemoveLibraryTracksError'];
    ['...on LibraryTrackCreateError']: '__union' &
      GraphQLTypes['LibraryTrackCreateError'];
    ['...on LibraryTrackEnqueueError']: '__union' &
      GraphQLTypes['LibraryTrackEnqueueError'];
    ['...on LibraryTracksDeleteError']: '__union' &
      GraphQLTypes['LibraryTracksDeleteError'];
    ['...on SpotifyTrackError']: '__union' & GraphQLTypes['SpotifyTrackError'];
    ['...on SpotifyTrackEnqueueError']: '__union' &
      GraphQLTypes['SpotifyTrackEnqueueError'];
    ['...on SimilarTracksError']: '__union' &
      GraphQLTypes['SimilarTracksError'];
    ['...on KeywordSearchError']: '__union' &
      GraphQLTypes['KeywordSearchError'];
    ['...on AugmentedKeywordsError']: '__union' &
      GraphQLTypes['AugmentedKeywordsError'];
    ['...on BrandValuesError']: '__union' & GraphQLTypes['BrandValuesError'];
    ['...on FreeTextSearchError']: '__union' &
      GraphQLTypes['FreeTextSearchError'];
    ['...on LyricsSearchError']: '__union' & GraphQLTypes['LyricsSearchError'];
  };
  /** Relay Style PageInfo (https://facebook.github.io/relay/graphql/connections.htm) */
  ['PageInfo']: {
    __typename: 'PageInfo';
    hasNextPage: boolean;
  };
  ['SpotifyArtistInfo']: {
    __typename: 'SpotifyArtistInfo';
    id: string;
    name: string;
  };
  ['SpotifyTrackInfo']: {
    __typename: 'SpotifyTrackInfo';
    id: string;
    name: string;
    artists: Array<GraphQLTypes['SpotifyArtistInfo']>;
  };
  ['TrackAnalysisScores']: {
    __typename: 'TrackAnalysisScores';
    excited: number;
    euphoric: number;
    uplifting: number;
    angry: number;
    tense: number;
    melancholic: number;
    relaxed: number;
    happy: number;
    sad: number;
    dark: number;
    pumped: number;
    energetic: number;
    calm: number;
  };
  ['TrackAnalysis']: {
    __typename: 'TrackAnalysis';
    arousal: number;
    valence: number;
    scores: GraphQLTypes['TrackAnalysisScores'];
  };
  ['AnalysisStatus']: AnalysisStatus;
  ['FileInfo']: {
    __typename: 'FileInfo';
    duration: number;
    fileSizeKb: number;
    bitrate: number;
    sampleRate: number;
  };
  ['TrackSegmentAnalysis']: {
    __typename: 'TrackSegmentAnalysis';
    start: number;
    /** the timestamp this segment belongs to */
    timestamp: number;
    duration: number;
    analysis: GraphQLTypes['TrackAnalysis'];
  };
  ['FileAnalysisLabel']: {
    __typename: 'FileAnalysisLabel';
    /** file analysis label title */
    title: string;
    /** identifier of the mood score this label represents */
    type: string;
    /** start of the interval */
    start: number;
    /** end of the interval */
    end: number;
    /** intensity of the mood score for the given interval */
    amount: number;
  };
  ['Mutation']: {
    __typename: 'Mutation';
    ping?: boolean | undefined;
    /** Create a cyanite file upload request. */
    fileUploadRequest: GraphQLTypes['FileUploadRequest'];
    /** Allows creating a crate in order to be able to group tracks within your library. */
    crateCreate: GraphQLTypes['CrateCreateResult'];
    /** Deletes an existing crate. */
    crateDelete: GraphQLTypes['CrateDeleteResult'];
    /** Adds multiple library tracks to a crate. */
    crateAddLibraryTracks: GraphQLTypes['CrateAddLibraryTracksResult'];
    /** Removes multiple library tracks from a crate. */
    crateRemoveLibraryTracks: GraphQLTypes['CrateRemoveLibraryTracksResult'];
    /** Create a LibraryTrack and automatically enqueue all the eligible analysis types. */
    libraryTrackCreate: GraphQLTypes['LibraryTrackCreateResult'];
    /** Enqueue a LibraryTrack manually.
This might be necessary when the automatic enqueuing performed via the 'libraryTrackCreate' mutation
fails due to having exceeded the analysis limit or a new analysis type is available. */
    libraryTrackEnqueue: GraphQLTypes['LibraryTrackEnqueueResult'];
    /** Deletes selected library tracks. CAUTION: This operation cannot be undone!
Allows to delete at most 100 tracks at once. */
    libraryTracksDelete: GraphQLTypes['LibraryTracksDeleteResult'];
    /** Enqueues YouTube analysis */
    youTubeTrackEnqueue: GraphQLTypes['YouTubeTrackEnqueueResult'];
    /** Enqueue a SpotifyTrack. */
    spotifyTrackEnqueue: GraphQLTypes['SpotifyTrackEnqueueResult'];
    /** Select your own set of brand values (up to 20) */
    selectBrandValues: GraphQLTypes['SelectBrandValuesResult'];
  };
  ['Query']: {
    __typename: 'Query';
    ping?: boolean | undefined;
    spotifyTrackAnalysis: GraphQLTypes['SpotifyTrackAnalysisResult'];
    libraryTrack: GraphQLTypes['LibraryTrackResult'];
    libraryTracks: GraphQLTypes['LibraryTrackConnection'];
    /** Returns crates created by the user. */
    crates: GraphQLTypes['CratesConnection'];
    /** Retrieve a SpotifyTrack via ID. */
    spotifyTrack: GraphQLTypes['SpotifyTrackResult'];
    /** Find tracks that match specific keywords. */
    keywordSearch: GraphQLTypes['KeywordSearchResult'];
    /** Search for keywords that can be used for the keyword search. */
    keywords: GraphQLTypes['KeywordConnection'];
    /** Get a list of all available brand values */
    brandValues: GraphQLTypes['BrandValuesResult'];
    freeTextSearch: GraphQLTypes['FreeTextSearchResult'];
    lyricsSearch: GraphQLTypes['LyricsSearchResult'];
  };
  ['Subscription']: {
    __typename: 'Subscription';
    ping?: boolean | undefined;
  };
  ['InDepthAnalysisGenre']: {
    __typename: 'InDepthAnalysisGenre';
    title: string;
    confidence: number;
  };
  /** This type is deprecated and will be removed in the future. */
  ['NoSimilarSpotifyTracksAvailableError']: {
    __typename: 'NoSimilarSpotifyTracksAvailableError';
    message: string;
  };
  /** This union type is deprecated and will be removed in the future. */
  ['SimilarSpotifyTracksResult']: {
    __typename:
      | 'NoSimilarSpotifyTracksAvailableError'
      | 'SimilarSpotifyTrackConnection';
    ['...on NoSimilarSpotifyTracksAvailableError']: '__union' &
      GraphQLTypes['NoSimilarSpotifyTracksAvailableError'];
    ['...on SimilarSpotifyTrackConnection']: '__union' &
      GraphQLTypes['SimilarSpotifyTrackConnection'];
  };
  ['SimilarLibraryTrackNode']: {
    __typename: 'SimilarLibraryTrackNode';
    distance: number;
    sort: number;
    inDepthAnalysisId: string;
    libraryTrack: GraphQLTypes['LibraryTrack'];
  };
  ['SimilarLibraryTrackEdge']: {
    __typename: 'SimilarLibraryTrackEdge';
    cursor: string;
    node: GraphQLTypes['SimilarLibraryTrackNode'];
  };
  ['SimilarLibraryTrackConnection']: {
    __typename: 'SimilarLibraryTrackConnection';
    pageInfo: GraphQLTypes['PageInfo'];
    edges: Array<GraphQLTypes['SimilarLibraryTrackEdge']>;
  };
  ['SimilaritySearchWeightFilter']: {
    genre?: number | undefined;
    mood?: number | undefined;
    voice?: number | undefined;
    mfccs?: number | undefined;
  };
  ['EnergyLevel']: EnergyLevel;
  ['EnergyDynamics']: EnergyDynamics;
  ['EmotionalProfile']: EmotionalProfile;
  ['EmotionalDynamics']: EmotionalDynamics;
  ['VoicePresenceProfile']: VoicePresenceProfile;
  ['PredominantVoiceGender']: PredominantVoiceGender;
  /** Describes the voice classifier results over time, mapped to the index of the timestamps. */
  ['VoiceSegmentScores']: {
    __typename: 'VoiceSegmentScores';
    /** Scores for female voice, mapped to the index of the timestamp. */
    female: Array<number | undefined>;
    /** Scores for instrumental, mapped to the index of the timestamp. */
    instrumental: Array<number | undefined>;
    /** Scores for male voice, mapped to the index of the timestamp. */
    male: Array<number | undefined>;
  };
  /** Describes the mean scores of the voice classifier result. */
  ['VoiceMeanScores']: {
    __typename: 'VoiceMeanScores';
    /** Mean female score. */
    female: number;
    /** Mean instrumental score. */
    instrumental: number;
    /** Mean instrumental male score. */
    male: number;
  };
  ['FileUploadRequest']: {
    __typename: 'FileUploadRequest';
    id: string;
    uploadUrl: string;
  };
  ['InDepthAnalysisCreateInput']: {
    fileName: string;
    uploadId: string;
    organizationId?: string | undefined;
    externalId?: string | undefined;
    /** The associated file tag name. It can later on be used for filtering. */
    tags?: Array<string> | undefined;
    /** Whether the file should be enqueued automatically */
    enqueue?: boolean | undefined;
  };
  /** This type is deprecated and will be removed in the future. */
  ['SimilarSpotifyTrackNode']: {
    __typename: 'SimilarSpotifyTrackNode';
    distance: number;
    score: number;
    spotifyTrackId: string;
    trackInfo: GraphQLTypes['SpotifyTrackInfo'];
  };
  /** This type is deprecated and will be removed in the future */
  ['SimilarSpotifyTrackEdge']: {
    __typename: 'SimilarSpotifyTrackEdge';
    cursor: string;
    node: GraphQLTypes['SimilarSpotifyTrackNode'];
  };
  /** This type is deprecated and will be removed in the future */
  ['SimilarSpotifyTrackConnection']: {
    __typename: 'SimilarSpotifyTrackConnection';
    pageInfo: GraphQLTypes['PageInfo'];
    edges: Array<GraphQLTypes['SimilarSpotifyTrackEdge']>;
  };
  /** spotify analysis related stuff */
  ['SpotifyTrackAnalysis']: {
    __typename: 'SpotifyTrackAnalysis';
    id: string;
    status: GraphQLTypes['AnalysisStatus'];
    similarLibraryTracks: GraphQLTypes['SpotifySimilarLibraryTracks'];
  };
  /** This type is deprecated and will be removed in the future. */
  ['SpotifySimilarLibraryTracks']: {
    __typename:
      | 'SpotifySimilarLibraryTracksResult'
      | 'SpotifySimilarLibraryTracksError';
    ['...on SpotifySimilarLibraryTracksResult']: '__union' &
      GraphQLTypes['SpotifySimilarLibraryTracksResult'];
    ['...on SpotifySimilarLibraryTracksError']: '__union' &
      GraphQLTypes['SpotifySimilarLibraryTracksError'];
  };
  /** This type is deprecated and will be removed in the future. */
  ['SpotifySimilarLibraryTracksResult']: {
    __typename: 'SpotifySimilarLibraryTracksResult';
    results: Array<GraphQLTypes['LibraryTrack']>;
  };
  /** This type is deprecated and will be removed in the future. */
  ['SpotifySimilarLibraryTracksError']: {
    __typename: 'SpotifySimilarLibraryTracksError';
    code: string;
    message: string;
  };
  ['SpotifyTrackNotFoundError']: {
    __typename: 'SpotifyTrackNotFoundError';
    message: string;
  };
  ['SpotifyTrackWithoutPreviewUrlError']: {
    __typename: 'SpotifyTrackWithoutPreviewUrlError';
    message: string;
  };
  ['SpotifyTrackAnalysisResult']: {
    __typename:
      | 'SpotifyTrackAnalysis'
      | 'SpotifyTrackNotFoundError'
      | 'SpotifyTrackWithoutPreviewUrlError';
    ['...on SpotifyTrackAnalysis']: '__union' &
      GraphQLTypes['SpotifyTrackAnalysis'];
    ['...on SpotifyTrackNotFoundError']: '__union' &
      GraphQLTypes['SpotifyTrackNotFoundError'];
    ['...on SpotifyTrackWithoutPreviewUrlError']: '__union' &
      GraphQLTypes['SpotifyTrackWithoutPreviewUrlError'];
  };
  ['Track']: {
    __typename: 'LibraryTrack' | 'SpotifyTrack';
    id: string;
    title: string;
    audioAnalysisV6: GraphQLTypes['AudioAnalysisV6'];
    /** Find similar tracks. */
    similarTracks: GraphQLTypes['SimilarTracksResult'];
    /** Augmented keywords that can be associated with the audio. */
    augmentedKeywords: GraphQLTypes['AugmentedKeywordsResult'];
    /** Brand values that can be associated with the audio. */
    brandValues: GraphQLTypes['BrandValuesResult'];
    ['...on LibraryTrack']: '__union' & GraphQLTypes['LibraryTrack'];
    ['...on SpotifyTrack']: '__union' & GraphQLTypes['SpotifyTrack'];
  };
  /** Possible results of querying Audio Analysis V6. */
  ['AudioAnalysisV6']: {
    __typename:
      | 'AudioAnalysisV6NotStarted'
      | 'AudioAnalysisV6Enqueued'
      | 'AudioAnalysisV6Processing'
      | 'AudioAnalysisV6Finished'
      | 'AudioAnalysisV6Failed';
    ['...on AudioAnalysisV6NotStarted']: '__union' &
      GraphQLTypes['AudioAnalysisV6NotStarted'];
    ['...on AudioAnalysisV6Enqueued']: '__union' &
      GraphQLTypes['AudioAnalysisV6Enqueued'];
    ['...on AudioAnalysisV6Processing']: '__union' &
      GraphQLTypes['AudioAnalysisV6Processing'];
    ['...on AudioAnalysisV6Finished']: '__union' &
      GraphQLTypes['AudioAnalysisV6Finished'];
    ['...on AudioAnalysisV6Failed']: '__union' &
      GraphQLTypes['AudioAnalysisV6Failed'];
  };
  /** Audio Analysis V6 hasn't been started for this track yet. */
  ['AudioAnalysisV6NotStarted']: {
    __typename: 'AudioAnalysisV6NotStarted';
    _?: boolean | undefined;
  };
  /** Audio Analysis V6 is enqueued and will be processed soon. */
  ['AudioAnalysisV6Enqueued']: {
    __typename: 'AudioAnalysisV6Enqueued';
    _?: boolean | undefined;
  };
  /** Audio Analysis V6 is being processed. */
  ['AudioAnalysisV6Processing']: {
    __typename: 'AudioAnalysisV6Processing';
    _?: boolean | undefined;
  };
  /** Audio Analysis V6 is completed and the results can be retrieved. */
  ['AudioAnalysisV6Finished']: {
    __typename: 'AudioAnalysisV6Finished';
    result: GraphQLTypes['AudioAnalysisV6Result'];
  };
  /** Audio Analysis V6 failed. */
  ['AudioAnalysisV6Failed']: {
    __typename: 'AudioAnalysisV6Failed';
    /** More detailed information on why the analysis has failed. */
    error: GraphQLTypes['AudioAnalysisV6Error'];
  };
  ['AudioAnalysisV6Error']: {
    __typename: 'AudioAnalysisV6Error';
    message: string;
  };
  /** Describes all possible genre tags. */
  ['AudioAnalysisV6GenreTags']: AudioAnalysisV6GenreTags;
  /** Describes all possible EDM subgenre tags. */
  ['AudioAnalysisV6SubgenreEdmTags']: AudioAnalysisV6SubgenreEdmTags;
  /** Describes all possible mood tags. */
  ['AudioAnalysisV6MoodTags']: AudioAnalysisV6MoodTags;
  /** Describes a track segment where the particular mood is most prominent. */
  ['AudioAnalysisV6MaximumMoodInterval']: {
    __typename: 'AudioAnalysisV6MaximumMoodInterval';
    mood: GraphQLTypes['AudioAnalysisV6MoodTags'];
    /** Start of the segment in seconds. */
    start: number;
    /** End of the segment in seconds. */
    end: number;
  };
  ['AudioAnalysisV6Genre']: {
    __typename: 'AudioAnalysisV6Genre';
    /** Mean prediction value for the "ambient" genre. */
    ambient: number;
    /** Mean prediction value for the "blues" genre. */
    blues: number;
    /** Mean prediction value for the "classical" genre. */
    classical: number;
    /** Mean prediction value for the "country" genre. */
    country: number;
    /** Mean prediction value for the "electronicDance" genre. */
    electronicDance: number;
    /** Mean prediction value for the "folk" genre. */
    folk: number;
    /** Mean prediction value for the "folkCountry" genre. */
    folkCountry: number;
    /** Mean prediction value for the "indieAlternative" genre. */
    indieAlternative: number;
    /** Mean prediction value for the "funkSoul" genre. */
    funkSoul: number;
    /** Mean prediction value for the "jazz" genre. */
    jazz: number;
    /** Mean prediction value for the "latin" genre. */
    latin: number;
    /** Mean prediction value for the "metal" genre. */
    metal: number;
    /** Mean prediction value for the "pop" genre. */
    pop: number;
    /** Mean prediction value for the "punk" genre. */
    punk: number;
    /** Mean prediction value for the "rapHipHop" genre. */
    rapHipHop: number;
    /** Mean prediction value for the "reggae" genre. */
    reggae: number;
    /** Mean prediction value for the "rnb" genre. */
    rnb: number;
    /** Mean prediction value for the "rock" genre. */
    rock: number;
    /** Mean prediction value for the "singerSongwriter" genre. */
    singerSongwriter: number;
  };
  ['AudioAnalysisV6GenreSegments']: {
    __typename: 'AudioAnalysisV6GenreSegments';
    /** Segments prediction value for the "ambient" genre. */
    ambient: Array<number>;
    /** Segments prediction value for the "blues" genre. */
    blues: Array<number>;
    /** Segments prediction value for the "classical" genre. */
    classical: Array<number>;
    /** Segments prediction value for the "country" genre. */
    country: Array<number>;
    /** Segments prediction value for the "electronicDance" genre. */
    electronicDance: Array<number>;
    /** Segments prediction value for the "folk" genre. */
    folk: Array<number>;
    /** Segments prediction value for the "folkCountry" genre. */
    folkCountry: Array<number>;
    /** Segments prediction value for the "indieAlternative" genre. */
    indieAlternative: Array<number>;
    /** Segments prediction value for the "funkSoul" genre. */
    funkSoul: Array<number>;
    /** Segments prediction value for the "jazz" genre. */
    jazz: Array<number>;
    /** Segments prediction value for the "latin" genre. */
    latin: Array<number>;
    /** Segments prediction value for the "metal" genre. */
    metal: Array<number>;
    /** Segments prediction value for the "pop" genre. */
    pop: Array<number>;
    /** Segments prediction value for the "punk" genre. */
    punk: Array<number>;
    /** Segments prediction value for the "rapHipHop" genre. */
    rapHipHop: Array<number>;
    /** Segments prediction value for the "reggae" genre. */
    reggae: Array<number>;
    /** Segments prediction value for the "rnb" genre. */
    rnb: Array<number>;
    /** Segments prediction value for the "rock" genre. */
    rock: Array<number>;
    /** Segments prediction value for the "singerSongwriter" genre. */
    singerSongwriter: Array<number>;
  };
  ['AudioAnalysisV6SubgenreSegments']: {
    __typename: 'AudioAnalysisV6SubgenreSegments';
    /** Segments prediction value for the "bluesRock" sub-genre. */
    bluesRock?: Array<number> | undefined;
    /** Segments prediction value for the "folkRock" sub-genre. */
    folkRock?: Array<number> | undefined;
    /** Segments prediction value for the "hardRock" sub-genre. */
    hardRock?: Array<number> | undefined;
    /** Segments prediction value for the "indieAlternative" sub-genre. */
    indieAlternative?: Array<number> | undefined;
    /** Segments prediction value for the "psychedelicProgressiveRock" sub-genre. */
    psychedelicProgressiveRock?: Array<number> | undefined;
    /** Segments prediction value for the "punk" sub-genre. */
    punk?: Array<number> | undefined;
    /** Segments prediction value for the "rockAndRoll" sub-genre. */
    rockAndRoll?: Array<number> | undefined;
    /** Segments prediction value for the "popSoftRock" sub-genre. */
    popSoftRock?: Array<number> | undefined;
    /** Segments prediction value for the "abstractIDMLeftfield" sub-genre. */
    abstractIDMLeftfield?: Array<number> | undefined;
    /** Segments prediction value for the "breakbeatDnB" sub-genre. */
    breakbeatDnB?: Array<number> | undefined;
    /** Segments prediction value for the "deepHouse" sub-genre. */
    deepHouse?: Array<number> | undefined;
    /** Segments prediction value for the "electro" sub-genre. */
    electro?: Array<number> | undefined;
    /** Segments prediction value for the "house" sub-genre. */
    house?: Array<number> | undefined;
    /** Segments prediction value for the "minimal" sub-genre. */
    minimal?: Array<number> | undefined;
    /** Segments prediction value for the "synthPop" sub-genre. */
    synthPop?: Array<number> | undefined;
    /** Segments prediction value for the "techHouse" sub-genre. */
    techHouse?: Array<number> | undefined;
    /** Segments prediction value for the "techno" sub-genre. */
    techno?: Array<number> | undefined;
    /** Segments prediction value for the "trance" sub-genre. */
    trance?: Array<number> | undefined;
    /** Segments prediction value for the "contemporaryRnB" sub-genre. */
    contemporaryRnB?: Array<number> | undefined;
    /** Segments prediction value for the "gangsta" sub-genre. */
    gangsta?: Array<number> | undefined;
    /** Segments prediction value for the "jazzyHipHop" sub-genre. */
    jazzyHipHop?: Array<number> | undefined;
    /** Segments prediction value for the "popRap" sub-genre. */
    popRap?: Array<number> | undefined;
    /** Segments prediction value for the "trap" sub-genre. */
    trap?: Array<number> | undefined;
    /** Segments prediction value for the "blackMetal" sub-genre. */
    blackMetal?: Array<number> | undefined;
    /** Segments prediction value for the "deathMetal" sub-genre. */
    deathMetal?: Array<number> | undefined;
    /** Segments prediction value for the "doomMetal" sub-genre. */
    doomMetal?: Array<number> | undefined;
    /** Segments prediction value for the "heavyMetal" sub-genre. */
    heavyMetal?: Array<number> | undefined;
    /** Segments prediction value for the "metalcore" sub-genre. */
    metalcore?: Array<number> | undefined;
    /** Segments prediction value for the "nuMetal" sub-genre. */
    nuMetal?: Array<number> | undefined;
    /** Segments prediction value for the "disco" sub-genre. */
    disco?: Array<number> | undefined;
    /** Segments prediction value for the "funk" sub-genre. */
    funk?: Array<number> | undefined;
    /** Segments prediction value for the "gospel" sub-genre. */
    gospel?: Array<number> | undefined;
    /** Segments prediction value for the "neoSoul" sub-genre. */
    neoSoul?: Array<number> | undefined;
    /** Segments prediction value for the "soul" sub-genre. */
    soul?: Array<number> | undefined;
    /** Segments prediction value for the "bigBandSwing" sub-genre. */
    bigBandSwing?: Array<number> | undefined;
    /** Segments prediction value for the "bebop" sub-genre. */
    bebop?: Array<number> | undefined;
    /** Segments prediction value for the "contemporaryJazz" sub-genre. */
    contemporaryJazz?: Array<number> | undefined;
    /** Segments prediction value for the "easyListening" sub-genre. */
    easyListening?: Array<number> | undefined;
    /** Segments prediction value for the "fusion" sub-genre. */
    fusion?: Array<number> | undefined;
    /** Segments prediction value for the "latinJazz" sub-genre. */
    latinJazz?: Array<number> | undefined;
    /** Segments prediction value for the "smoothJazz" sub-genre. */
    smoothJazz?: Array<number> | undefined;
    /** Segments prediction value for the "country" sub-genre. */
    country?: Array<number> | undefined;
    /** Segments prediction value for the "folk" sub-genre. */
    folk?: Array<number> | undefined;
  };
  /** This type is fully deprecated all the subgenre EDM values moved to the AudioAnalysisV6Subgenre type. */
  ['AudioAnalysisV6SubgenreEdm']: {
    __typename: 'AudioAnalysisV6SubgenreEdm';
    /** Mean prediction value for the "breakbeatDrumAndBass" EDM subgenre. */
    breakbeatDrumAndBass: number;
    /** Mean prediction value for the "deepHouse" EDM subgenre. */
    deepHouse: number;
    /** Mean prediction value for the "electro" EDM subgenre. */
    electro: number;
    /** Mean prediction value for the "house" EDM subgenre. */
    house: number;
    /** Mean prediction value for the "minimal" EDM subgenre. */
    minimal: number;
    /** Mean prediction value for the "techHouse" EDM subgenre. */
    techHouse: number;
    /** Mean prediction value for the "techno" EDM subgenre. */
    techno: number;
    /** Mean prediction value for the "trance" EDM subgenre. */
    trance: number;
  };
  ['AudioAnalysisV6SubgenreTags']: AudioAnalysisV6SubgenreTags;
  ['AudioAnalysisV6Subgenre']: {
    __typename: 'AudioAnalysisV6Subgenre';
    /** Mean prediction value for the "bluesRock" sub-genre. */
    bluesRock?: number | undefined;
    /** Mean prediction value for the "folkRock" sub-genre. */
    folkRock?: number | undefined;
    /** Mean prediction value for the "hardRock" sub-genre. */
    hardRock?: number | undefined;
    /** Mean prediction value for the "indieAlternative" sub-genre. */
    indieAlternative?: number | undefined;
    /** Mean prediction value for the "psychedelicProgressiveRock" sub-genre. */
    psychedelicProgressiveRock?: number | undefined;
    /** Mean prediction value for the "punk" sub-genre. */
    punk?: number | undefined;
    /** Mean prediction value for the "rockAndRoll" sub-genre. */
    rockAndRoll?: number | undefined;
    /** Mean prediction value for the "popSoftRock" sub-genre. */
    popSoftRock?: number | undefined;
    /** Mean prediction value for the "abstractIDMLeftfield" sub-genre. */
    abstractIDMLeftfield?: number | undefined;
    /** Mean prediction value for the "breakbeatDnB" sub-genre. */
    breakbeatDnB?: number | undefined;
    /** Mean prediction value for the "deepHouse" sub-genre. */
    deepHouse?: number | undefined;
    /** Mean prediction value for the "electro" sub-genre. */
    electro?: number | undefined;
    /** Mean prediction value for the "house" sub-genre. */
    house?: number | undefined;
    /** Mean prediction value for the "minimal" sub-genre. */
    minimal?: number | undefined;
    /** Mean prediction value for the "synthPop" sub-genre. */
    synthPop?: number | undefined;
    /** Mean prediction value for the "techHouse" sub-genre. */
    techHouse?: number | undefined;
    /** Mean prediction value for the "techno" sub-genre. */
    techno?: number | undefined;
    /** Mean prediction value for the "trance" sub-genre. */
    trance?: number | undefined;
    /** Mean prediction value for the "contemporaryRnB" sub-genre. */
    contemporaryRnB?: number | undefined;
    /** Mean prediction value for the "gangsta" sub-genre. */
    gangsta?: number | undefined;
    /** Mean prediction value for the "jazzyHipHop" sub-genre. */
    jazzyHipHop?: number | undefined;
    /** Mean prediction value for the "popRap" sub-genre. */
    popRap?: number | undefined;
    /** Mean prediction value for the "trap" sub-genre. */
    trap?: number | undefined;
    /** Mean prediction value for the "blackMetal" sub-genre. */
    blackMetal?: number | undefined;
    /** Mean prediction value for the "deathMetal" sub-genre. */
    deathMetal?: number | undefined;
    /** Mean prediction value for the "doomMetal" sub-genre. */
    doomMetal?: number | undefined;
    /** Mean prediction value for the "heavyMetal" sub-genre. */
    heavyMetal?: number | undefined;
    /** Mean prediction value for the "metalcore" sub-genre. */
    metalcore?: number | undefined;
    /** Mean prediction value for the "nuMetal" sub-genre. */
    nuMetal?: number | undefined;
    /** Mean prediction value for the "disco" sub-genre. */
    disco?: number | undefined;
    /** Mean prediction value for the "funk" sub-genre. */
    funk?: number | undefined;
    /** Mean prediction value for the "gospel" sub-genre. */
    gospel?: number | undefined;
    /** Mean prediction value for the "neoSoul" sub-genre. */
    neoSoul?: number | undefined;
    /** Mean prediction value for the "soul" sub-genre. */
    soul?: number | undefined;
    /** Mean prediction value for the "bigBandSwing" sub-genre. */
    bigBandSwing?: number | undefined;
    /** Mean prediction value for the "bebop" sub-genre. */
    bebop?: number | undefined;
    /** Mean prediction value for the "contemporaryJazz" sub-genre. */
    contemporaryJazz?: number | undefined;
    /** Mean prediction value for the "easyListening" sub-genre. */
    easyListening?: number | undefined;
    /** Mean prediction value for the "fusion" sub-genre. */
    fusion?: number | undefined;
    /** Mean prediction value for the "latinJazz" sub-genre. */
    latinJazz?: number | undefined;
    /** Mean prediction value for the "smoothJazz" sub-genre. */
    smoothJazz?: number | undefined;
    /** Mean prediction value for the "country" sub-genre. */
    country?: number | undefined;
    /** Mean prediction value for the "folk" sub-genre. */
    folk?: number | undefined;
  };
  ['AudioAnalysisV6Mood']: {
    __typename: 'AudioAnalysisV6Mood';
    /** Mean prediction value for the "aggressive" mood. */
    aggressive: number;
    /** Mean prediction value for the "calm" mood. */
    calm: number;
    /** Mean prediction value for the "chilled" mood. */
    chilled: number;
    /** Mean prediction value for the "dark" mood. */
    dark: number;
    /** Mean prediction value for the "energetic" mood. */
    energetic: number;
    /** Mean prediction value for the "epic" mood. */
    epic: number;
    /** Mean prediction value for the "happy" mood. */
    happy: number;
    /** Mean prediction value for the "romantic" mood. */
    romantic: number;
    /** Mean prediction value for the "sad" mood. */
    sad: number;
    /** Mean prediction value for the "scary" mood. */
    scary: number;
    /** Mean prediction value for the "sexy" mood. */
    sexy: number;
    /** Mean prediction value for the "ethereal" mood. */
    ethereal: number;
    /** Mean prediction value for the "uplifting" mood. */
    uplifting: number;
  };
  ['AudioAnalysisV6MoodSegments']: {
    __typename: 'AudioAnalysisV6MoodSegments';
    /** Segments prediction value for the "aggressive" mood. */
    aggressive: Array<number>;
    /** Segments prediction value for the "calm" mood. */
    calm: Array<number>;
    /** Segments prediction value for the "chilled" mood. */
    chilled: Array<number>;
    /** Segments prediction value for the "dark" mood. */
    dark: Array<number>;
    /** Segments prediction value for the "energetic" mood. */
    energetic: Array<number>;
    /** Segments prediction value for the "epic" mood. */
    epic: Array<number>;
    /** Segments prediction value for the "happy" mood. */
    happy: Array<number>;
    /** Segments prediction value for the "romantic" mood. */
    romantic: Array<number>;
    /** Segments prediction value for the "sad" mood. */
    sad: Array<number>;
    /** Segments prediction value for the "scary" mood. */
    scary: Array<number>;
    /** Segments prediction value for the "sexy" mood. */
    sexy: Array<number>;
    /** Segments prediction value for the "ethereal" mood. */
    ethereal: Array<number>;
    /** Segments prediction value for the "uplifting" mood. */
    uplifting: Array<number>;
  };
  ['AudioAnalysisV6Instruments']: {
    __typename: 'AudioAnalysisV6Instruments';
    /** Mean prediction value for the "percussion" instrument presence. */
    percussion: number;
  };
  /** Instruments detected by the instrument recognition. */
  ['AudioAnalysisV6InstrumentTags']: AudioAnalysisV6InstrumentTags;
  /** The intensity of an instrument's presence throughout a track. */
  ['AudioAnalysisInstrumentPresenceLabel']: AudioAnalysisInstrumentPresenceLabel;
  /** The intensity of an instrument's presence throughout a track. */
  ['AudioAnalysisV6InstrumentPresence']: {
    __typename: 'AudioAnalysisV6InstrumentPresence';
    /** Intensity of the percussion instrument. */
    percussion: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'];
    /** Intensity of the synthesizer instrument. */
    synth: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'];
    /** Intensity of the piano instrument. */
    piano: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'];
    /** Intensity of the acoustic guitar instrument. */
    acousticGuitar: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'];
    /** Intensity of the electric guitar instrument. */
    electricGuitar: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'];
    /** Intensity of the strings instrument. */
    strings: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'];
    /** Intensity of the bass instrument. */
    bass: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'];
    /** Intensity of the bass guitar instrument. */
    bassGuitar: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'];
    /** Intensity of the brass/woodwinds instrument. */
    brassWoodwinds: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'];
  };
  ['AudioAnalysisV6InstrumentsSegments']: {
    __typename: 'AudioAnalysisV6InstrumentsSegments';
    /** Segments prediction value for the "percussion" instrument presence. */
    percussion: Array<number>;
    /** Segments prediction value for the "synth" instrument presence. */
    synth: Array<number>;
    /** Segments prediction value for the "piano" instrument presence. */
    piano: Array<number>;
    /** Segments prediction value for the "acousticGuitar" instrument presence. */
    acousticGuitar: Array<number>;
    /** Segments prediction value for the "electricGuitar" instrument presence. */
    electricGuitar: Array<number>;
    /** Segments prediction value for the "strings" instrument presence. */
    strings: Array<number>;
    /** Segments prediction value for the "bass" instrument presence. */
    bass: Array<number>;
    /** Segments prediction value for the "bassGuitar" instrument presence. */
    bassGuitar: Array<number>;
    /** Segments prediction value for the "brassWoodwinds" instrument presence. */
    brassWoodwinds: Array<number>;
  };
  ['AudioAnalysisV6Voice']: {
    __typename: 'AudioAnalysisV6Voice';
    /** Mean prediction value for the "female" voice type. */
    female: number;
    /** Mean prediction value for the "instrumental" voice type. */
    instrumental: number;
    /** Mean prediction value for the "male" voice type. */
    male: number;
  };
  ['AudioAnalysisV6VoiceSegments']: {
    __typename: 'AudioAnalysisV6VoiceSegments';
    /** Segments prediction value for the "female" voice type. */
    female: Array<number>;
    /** Segments prediction value for the "instrumental" voice type. */
    instrumental: Array<number>;
    /** Segments prediction value for the "male" voice type. */
    male: Array<number>;
  };
  ['AudioAnalysisV6SubgenreEdmSegments']: {
    __typename: 'AudioAnalysisV6SubgenreEdmSegments';
    /** Segments prediction value for the "breakbeatDrumAndBass" EDM subgenre. */
    breakbeatDrumAndBass: Array<number>;
    /** Segments prediction value for the "deepHouse" EDM subgenre. */
    deepHouse: Array<number>;
    /** Segments prediction value for the "electro" EDM subgenre. */
    electro: Array<number>;
    /** Segments prediction value for the "house" EDM subgenre. */
    house: Array<number>;
    /** Segments prediction value for the "minimal" EDM subgenre. */
    minimal: Array<number>;
    /** Segments prediction value for the "techHouse" EDM subgenre. */
    techHouse: Array<number>;
    /** Segments prediction value for the "techno" EDM subgenre. */
    techno: Array<number>;
    /** Segments prediction value for the "trance" EDM subgenre. */
    trance: Array<number>;
  };
  ['AudioAnalysisV6Movement']: {
    __typename: 'AudioAnalysisV6Movement';
    bouncy: number;
    driving: number;
    flowing: number;
    groovy: number;
    nonrhythmic: number;
    pulsing: number;
    robotic: number;
    running: number;
    steady: number;
    stomping: number;
  };
  ['AudioAnalysisV6MovementSegments']: {
    __typename: 'AudioAnalysisV6MovementSegments';
    bouncy: Array<number>;
    driving: Array<number>;
    flowing: Array<number>;
    groovy: Array<number>;
    nonrhythmic: Array<number>;
    pulsing: Array<number>;
    robotic: Array<number>;
    running: Array<number>;
    steady: Array<number>;
    stomping: Array<number>;
  };
  ['AudioAnalysisV6Character']: {
    __typename: 'AudioAnalysisV6Character';
    bold: number;
    cool: number;
    epic: number;
    ethereal: number;
    heroic: number;
    luxurious: number;
    magical: number;
    mysterious: number;
    playful: number;
    powerful: number;
    retro: number;
    sophisticated: number;
    sparkling: number;
    sparse: number;
    unpolished: number;
    warm: number;
  };
  ['AudioAnalysisV6CharacterSegments']: {
    __typename: 'AudioAnalysisV6CharacterSegments';
    bold: Array<number>;
    cool: Array<number>;
    epic: Array<number>;
    ethereal: Array<number>;
    heroic: Array<number>;
    luxurious: Array<number>;
    magical: Array<number>;
    mysterious: Array<number>;
    playful: Array<number>;
    powerful: Array<number>;
    retro: Array<number>;
    sophisticated: Array<number>;
    sparkling: Array<number>;
    sparse: Array<number>;
    unpolished: Array<number>;
    warm: Array<number>;
  };
  ['AudioAnalysisV6ClassicalEpoch']: {
    __typename: 'AudioAnalysisV6ClassicalEpoch';
    middleAge: number;
    renaissance: number;
    baroque: number;
    classical: number;
    romantic: number;
    contemporary: number;
  };
  ['AudioAnalysisV6ClassicalEpochSegments']: {
    __typename: 'AudioAnalysisV6ClassicalEpochSegments';
    middleAge: Array<number>;
    renaissance: Array<number>;
    baroque: Array<number>;
    classical: Array<number>;
    romantic: Array<number>;
    contemporary: Array<number>;
  };
  ['AudioAnalysisV6MoodAdvanced']: {
    __typename: 'AudioAnalysisV6MoodAdvanced';
    anxious: number;
    barren: number;
    cold: number;
    creepy: number;
    dark: number;
    disturbing: number;
    eerie: number;
    evil: number;
    fearful: number;
    mysterious: number;
    nervous: number;
    restless: number;
    spooky: number;
    strange: number;
    supernatural: number;
    suspenseful: number;
    tense: number;
    weird: number;
    aggressive: number;
    agitated: number;
    angry: number;
    dangerous: number;
    fiery: number;
    intense: number;
    passionate: number;
    ponderous: number;
    violent: number;
    comedic: number;
    eccentric: number;
    funny: number;
    mischievous: number;
    quirky: number;
    whimsical: number;
    boisterous: number;
    boingy: number;
    bright: number;
    celebratory: number;
    cheerful: number;
    excited: number;
    feelGood: number;
    fun: number;
    happy: number;
    joyous: number;
    lighthearted: number;
    perky: number;
    playful: number;
    rollicking: number;
    upbeat: number;
    calm: number;
    contented: number;
    dreamy: number;
    introspective: number;
    laidBack: number;
    leisurely: number;
    lyrical: number;
    peaceful: number;
    quiet: number;
    relaxed: number;
    serene: number;
    soothing: number;
    spiritual: number;
    tranquil: number;
    bittersweet: number;
    blue: number;
    depressing: number;
    gloomy: number;
    heavy: number;
    lonely: number;
    melancholic: number;
    mournful: number;
    poignant: number;
    sad: number;
    frightening: number;
    horror: number;
    menacing: number;
    nightmarish: number;
    ominous: number;
    panicStricken: number;
    scary: number;
    concerned: number;
    determined: number;
    dignified: number;
    emotional: number;
    noble: number;
    serious: number;
    solemn: number;
    thoughtful: number;
    cool: number;
    seductive: number;
    sexy: number;
    adventurous: number;
    confident: number;
    courageous: number;
    resolute: number;
    energetic: number;
    epic: number;
    exciting: number;
    exhilarating: number;
    heroic: number;
    majestic: number;
    powerful: number;
    prestigious: number;
    relentless: number;
    strong: number;
    triumphant: number;
    victorious: number;
    delicate: number;
    graceful: number;
    hopeful: number;
    innocent: number;
    intimate: number;
    kind: number;
    light: number;
    loving: number;
    nostalgic: number;
    reflective: number;
    romantic: number;
    sentimental: number;
    soft: number;
    sweet: number;
    tender: number;
    warm: number;
    anthemic: number;
    aweInspiring: number;
    euphoric: number;
    inspirational: number;
    motivational: number;
    optimistic: number;
    positive: number;
    proud: number;
    soaring: number;
    uplifting: number;
  };
  ['AudioAnalysisV6MoodAdvancedSegments']: {
    __typename: 'AudioAnalysisV6MoodAdvancedSegments';
    anxious: Array<number>;
    barren: Array<number>;
    cold: Array<number>;
    creepy: Array<number>;
    dark: Array<number>;
    disturbing: Array<number>;
    eerie: Array<number>;
    evil: Array<number>;
    fearful: Array<number>;
    mysterious: Array<number>;
    nervous: Array<number>;
    restless: Array<number>;
    spooky: Array<number>;
    strange: Array<number>;
    supernatural: Array<number>;
    suspenseful: Array<number>;
    tense: Array<number>;
    weird: Array<number>;
    aggressive: Array<number>;
    agitated: Array<number>;
    angry: Array<number>;
    dangerous: Array<number>;
    fiery: Array<number>;
    intense: Array<number>;
    passionate: Array<number>;
    ponderous: Array<number>;
    violent: Array<number>;
    comedic: Array<number>;
    eccentric: Array<number>;
    funny: Array<number>;
    mischievous: Array<number>;
    quirky: Array<number>;
    whimsical: Array<number>;
    boisterous: Array<number>;
    boingy: Array<number>;
    bright: Array<number>;
    celebratory: Array<number>;
    cheerful: Array<number>;
    excited: Array<number>;
    feelGood: Array<number>;
    fun: Array<number>;
    happy: Array<number>;
    joyous: Array<number>;
    lighthearted: Array<number>;
    perky: Array<number>;
    playful: Array<number>;
    rollicking: Array<number>;
    upbeat: Array<number>;
    calm: Array<number>;
    contented: Array<number>;
    dreamy: Array<number>;
    introspective: Array<number>;
    laidBack: Array<number>;
    leisurely: Array<number>;
    lyrical: Array<number>;
    peaceful: Array<number>;
    quiet: Array<number>;
    relaxed: Array<number>;
    serene: Array<number>;
    soothing: Array<number>;
    spiritual: Array<number>;
    tranquil: Array<number>;
    bittersweet: Array<number>;
    blue: Array<number>;
    depressing: Array<number>;
    gloomy: Array<number>;
    heavy: Array<number>;
    lonely: Array<number>;
    melancholic: Array<number>;
    mournful: Array<number>;
    poignant: Array<number>;
    sad: Array<number>;
    frightening: Array<number>;
    horror: Array<number>;
    menacing: Array<number>;
    nightmarish: Array<number>;
    ominous: Array<number>;
    panicStricken: Array<number>;
    scary: Array<number>;
    concerned: Array<number>;
    determined: Array<number>;
    dignified: Array<number>;
    emotional: Array<number>;
    noble: Array<number>;
    serious: Array<number>;
    solemn: Array<number>;
    thoughtful: Array<number>;
    cool: Array<number>;
    seductive: Array<number>;
    sexy: Array<number>;
    adventurous: Array<number>;
    confident: Array<number>;
    courageous: Array<number>;
    resolute: Array<number>;
    energetic: Array<number>;
    epic: Array<number>;
    exciting: Array<number>;
    exhilarating: Array<number>;
    heroic: Array<number>;
    majestic: Array<number>;
    powerful: Array<number>;
    prestigious: Array<number>;
    relentless: Array<number>;
    strong: Array<number>;
    triumphant: Array<number>;
    victorious: Array<number>;
    delicate: Array<number>;
    graceful: Array<number>;
    hopeful: Array<number>;
    innocent: Array<number>;
    intimate: Array<number>;
    kind: Array<number>;
    light: Array<number>;
    loving: Array<number>;
    nostalgic: Array<number>;
    reflective: Array<number>;
    romantic: Array<number>;
    sentimental: Array<number>;
    soft: Array<number>;
    sweet: Array<number>;
    tender: Array<number>;
    warm: Array<number>;
    anthemic: Array<number>;
    aweInspiring: Array<number>;
    euphoric: Array<number>;
    inspirational: Array<number>;
    motivational: Array<number>;
    optimistic: Array<number>;
    positive: Array<number>;
    proud: Array<number>;
    soaring: Array<number>;
    uplifting: Array<number>;
  };
  /** Describes possible energy levels values. */
  ['AudioAnalysisV6EnergyLevel']: AudioAnalysisV6EnergyLevel;
  /** Describes possible energy dynamics values. */
  ['AudioAnalysisV6EnergyDynamics']: AudioAnalysisV6EnergyDynamics;
  /** Describes possible emotional profile values. */
  ['AudioAnalysisV6EmotionalProfile']: AudioAnalysisV6EmotionalProfile;
  /** Describes possible emotional dynamics values. */
  ['AudioAnalysisV6EmotionalDynamics']: AudioAnalysisV6EmotionalDynamics;
  /** Describes possible voice presence profile values. */
  ['AudioAnalysisV6VoicePresenceProfile']: AudioAnalysisV6VoicePresenceProfile;
  /** Describes possible predominant voice gender values. */
  ['AudioAnalysisV6PredominantVoiceGender']: AudioAnalysisV6PredominantVoiceGender;
  ['AudioAnalysisV6VoiceTags']: AudioAnalysisV6VoiceTags;
  ['AudioAnalysisV6MovementTags']: AudioAnalysisV6MovementTags;
  ['AudioAnalysisV6CharacterTags']: AudioAnalysisV6CharacterTags;
  ['AudioAnalysisV6ClassicalEpochTags']: AudioAnalysisV6ClassicalEpochTags;
  ['AudioAnalysisV6MoodAdvancedTags']: AudioAnalysisV6MoodAdvancedTags;
  ['AudioAnalysisV6Segments']: {
    __typename: 'AudioAnalysisV6Segments';
    /** Index of the most representative segment for the track. */
    representativeSegmentIndex: number;
    /** The timestamps of each analysis segment. */
    timestamps: Array<number>;
    /** The mood prediction of each analysis segment. */
    mood?: GraphQLTypes['AudioAnalysisV6MoodSegments'] | undefined;
    /** The voice prediction of each analysis segment. */
    voice?: GraphQLTypes['AudioAnalysisV6VoiceSegments'] | undefined;
    /** The instrument prediction of each analysis segment. */
    instruments?:
      | GraphQLTypes['AudioAnalysisV6InstrumentsSegments']
      | undefined;
    /** The instrument prediction of each analysis segment. */
    advancedInstruments?:
      | GraphQLTypes['AudioAnalysisV7InstrumentsSegments']
      | undefined;
    /** The instrument prediction of each analysis segment. */
    advancedInstrumentsExtended?:
      | GraphQLTypes['AudioAnalysisV7ExtendedInstrumentsSegments']
      | undefined;
    /** The genre prediction of each analysis segment. */
    genre?: GraphQLTypes['AudioAnalysisV6GenreSegments'] | undefined;
    /** The sub-genre prediction of each analysis segment. */
    subgenre?: GraphQLTypes['AudioAnalysisV6SubgenreSegments'] | undefined;
    /** The EDM subgenre prediction of each analysis segments. It is null if the track has not been recognized as EDM music. */
    subgenreEdm?:
      | GraphQLTypes['AudioAnalysisV6SubgenreEdmSegments']
      | undefined;
    /** The valance prediction of each analysis segment. */
    valence?: Array<number> | undefined;
    /** The arousal prediction of each analysis segment. */
    arousal?: Array<number> | undefined;
    moodAdvanced?:
      | GraphQLTypes['AudioAnalysisV6MoodAdvancedSegments']
      | undefined;
    movement?: GraphQLTypes['AudioAnalysisV6MovementSegments'] | undefined;
    character?: GraphQLTypes['AudioAnalysisV6CharacterSegments'] | undefined;
    classicalEpoch?:
      | GraphQLTypes['AudioAnalysisV6ClassicalEpochSegments']
      | undefined;
    /** The genre prediction of each analysis segment. */
    advancedGenre?: GraphQLTypes['AudioAnalysisV7GenreSegments'] | undefined;
    /** The sub-genre prediction of each analysis segment. */
    advancedSubgenre?:
      | GraphQLTypes['AudioAnalysisV7SubgenreSegments']
      | undefined;
  };
  ['AudioAnalysisV6KeyPrediction']: {
    __typename: 'AudioAnalysisV6KeyPrediction';
    /** The predicted Key value. */
    value: GraphQLTypes['MusicalKey'];
    /** The confidence of predicted key value. */
    confidence?: number | undefined;
  };
  ['AudioAnalysisV6BPMPrediction']: {
    __typename: 'AudioAnalysisV6BPMPrediction';
    /** The predicted BPM value. */
    value: number;
    /** The confidence of the predicted BPM value. */
    confidence?: number | undefined;
  };
  ['AudioAnalysisV7InstrumentsSegments']: {
    __typename: 'AudioAnalysisV7InstrumentsSegments';
    /** Segments prediction value for the "percussion" instrument presence. */
    percussion?: Array<number> | undefined;
    /** Segments prediction value for the "synth" instrument presence. */
    synth?: Array<number> | undefined;
    /** Segments prediction value for the "piano" instrument presence. */
    piano?: Array<number> | undefined;
    /** Segments prediction value for the "acousticGuitar" instrument presence. */
    acousticGuitar?: Array<number> | undefined;
    /** Segments prediction value for the "electricGuitar" instrument presence. */
    electricGuitar?: Array<number> | undefined;
    /** Segments prediction value for the "strings" instrument presence. */
    strings?: Array<number> | undefined;
    /** Segments prediction value for the "bass" instrument presence. */
    bass?: Array<number> | undefined;
    /** Segments prediction value for the "bassGuitar" instrument presence. */
    bassGuitar?: Array<number> | undefined;
    /** Segments prediction value for the "woodwinds" instrument presence. */
    woodwinds?: Array<number> | undefined;
    /** Segments prediction value for the "brass" instrument presence. */
    brass?: Array<number> | undefined;
  };
  /** Instruments detected by the instrument recognition. */
  ['AudioAnalysisV7InstrumentTags']: AudioAnalysisV7InstrumentTags;
  /** The intensity of an instrument's presence throughout a track. */
  ['AudioAnalysisV7InstrumentPresence']: {
    __typename: 'AudioAnalysisV7InstrumentPresence';
    /** Intensity of the percussion instrument. */
    percussion: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'];
    /** Intensity of the synthesizer instrument. */
    synth: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'];
    /** Intensity of the piano instrument. */
    piano: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'];
    /** Intensity of the acoustic guitar instrument. */
    acousticGuitar: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'];
    /** Intensity of the electric guitar instrument. */
    electricGuitar: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'];
    /** Intensity of the strings instrument. */
    strings: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'];
    /** Intensity of the bass instrument. */
    bass: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'];
    /** Intensity of the bass guitar instrument. */
    bassGuitar: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'];
    /** Intensity of the brass instrument. */
    brass?: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    /** Intensity of the woodwinds instrument. */
    woodwinds?:
      | GraphQLTypes['AudioAnalysisInstrumentPresenceLabel']
      | undefined;
  };
  ['AudioAnalysisV7ExtendedInstrumentsSegments']: {
    __typename: 'AudioAnalysisV7ExtendedInstrumentsSegments';
    acousticGuitar?: Array<number | undefined> | undefined;
    bass?: Array<number | undefined> | undefined;
    bassGuitar?: Array<number | undefined> | undefined;
    electricGuitar?: Array<number | undefined> | undefined;
    percussion?: Array<number | undefined> | undefined;
    piano?: Array<number | undefined> | undefined;
    synth?: Array<number | undefined> | undefined;
    strings?: Array<number | undefined> | undefined;
    brass?: Array<number | undefined> | undefined;
    woodwinds?: Array<number | undefined> | undefined;
    tuba?: Array<number | undefined> | undefined;
    frenchHorn?: Array<number | undefined> | undefined;
    oboe?: Array<number | undefined> | undefined;
    mandolin?: Array<number | undefined> | undefined;
    cello?: Array<number | undefined> | undefined;
    marimba?: Array<number | undefined> | undefined;
    vibraphone?: Array<number | undefined> | undefined;
    electricPiano?: Array<number | undefined> | undefined;
    electricOrgan?: Array<number | undefined> | undefined;
    harp?: Array<number | undefined> | undefined;
    ukulele?: Array<number | undefined> | undefined;
    harpsichord?: Array<number | undefined> | undefined;
    churchOrgan?: Array<number | undefined> | undefined;
    doubleBass?: Array<number | undefined> | undefined;
    xylophone?: Array<number | undefined> | undefined;
    glockenspiel?: Array<number | undefined> | undefined;
    electronicDrums?: Array<number | undefined> | undefined;
    drumKit?: Array<number | undefined> | undefined;
    accordion?: Array<number | undefined> | undefined;
    violin?: Array<number | undefined> | undefined;
    flute?: Array<number | undefined> | undefined;
    sax?: Array<number | undefined> | undefined;
    trumpet?: Array<number | undefined> | undefined;
    celeste?: Array<number | undefined> | undefined;
    pizzicato?: Array<number | undefined> | undefined;
    banjo?: Array<number | undefined> | undefined;
    clarinet?: Array<number | undefined> | undefined;
    bells?: Array<number | undefined> | undefined;
    steelDrums?: Array<number | undefined> | undefined;
    bongoConga?: Array<number | undefined> | undefined;
    africanPercussion?: Array<number | undefined> | undefined;
    tabla?: Array<number | undefined> | undefined;
    sitar?: Array<number | undefined> | undefined;
    taiko?: Array<number | undefined> | undefined;
    asianFlute?: Array<number | undefined> | undefined;
    asianStrings?: Array<number | undefined> | undefined;
    luteOud?: Array<number | undefined> | undefined;
  };
  /** Instruments detected by the instrument recognition. */
  ['AudioAnalysisV7ExtendedInstrumentTags']: AudioAnalysisV7ExtendedInstrumentTags;
  /** The intensity of an instrument's presence throughout a track. */
  ['AudioAnalysisV7ExtendedInstrumentPresence']: {
    __typename: 'AudioAnalysisV7ExtendedInstrumentPresence';
    acousticGuitar?:
      | GraphQLTypes['AudioAnalysisInstrumentPresenceLabel']
      | undefined;
    bass?: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    bassGuitar?:
      | GraphQLTypes['AudioAnalysisInstrumentPresenceLabel']
      | undefined;
    electricGuitar?:
      | GraphQLTypes['AudioAnalysisInstrumentPresenceLabel']
      | undefined;
    percussion?:
      | GraphQLTypes['AudioAnalysisInstrumentPresenceLabel']
      | undefined;
    piano?: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    synth?: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    strings?: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    brass?: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    woodwinds?:
      | GraphQLTypes['AudioAnalysisInstrumentPresenceLabel']
      | undefined;
    tuba?: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    frenchHorn?:
      | GraphQLTypes['AudioAnalysisInstrumentPresenceLabel']
      | undefined;
    oboe?: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    mandolin?: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    cello?: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    marimba?: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    vibraphone?:
      | GraphQLTypes['AudioAnalysisInstrumentPresenceLabel']
      | undefined;
    electricPiano?:
      | GraphQLTypes['AudioAnalysisInstrumentPresenceLabel']
      | undefined;
    electricOrgan?:
      | GraphQLTypes['AudioAnalysisInstrumentPresenceLabel']
      | undefined;
    harp?: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    ukulele?: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    harpsichord?:
      | GraphQLTypes['AudioAnalysisInstrumentPresenceLabel']
      | undefined;
    churchOrgan?:
      | GraphQLTypes['AudioAnalysisInstrumentPresenceLabel']
      | undefined;
    doubleBass?:
      | GraphQLTypes['AudioAnalysisInstrumentPresenceLabel']
      | undefined;
    xylophone?:
      | GraphQLTypes['AudioAnalysisInstrumentPresenceLabel']
      | undefined;
    glockenspiel?:
      | GraphQLTypes['AudioAnalysisInstrumentPresenceLabel']
      | undefined;
    electronicDrums?:
      | GraphQLTypes['AudioAnalysisInstrumentPresenceLabel']
      | undefined;
    drumKit?: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    accordion?:
      | GraphQLTypes['AudioAnalysisInstrumentPresenceLabel']
      | undefined;
    violin?: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    flute?: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    sax?: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    trumpet?: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    celeste?: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    pizzicato?:
      | GraphQLTypes['AudioAnalysisInstrumentPresenceLabel']
      | undefined;
    banjo?: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    clarinet?: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    bells?: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    steelDrums?:
      | GraphQLTypes['AudioAnalysisInstrumentPresenceLabel']
      | undefined;
    bongoConga?:
      | GraphQLTypes['AudioAnalysisInstrumentPresenceLabel']
      | undefined;
    africanPercussion?:
      | GraphQLTypes['AudioAnalysisInstrumentPresenceLabel']
      | undefined;
    tabla?: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    sitar?: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    taiko?: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
    asianFlute?:
      | GraphQLTypes['AudioAnalysisInstrumentPresenceLabel']
      | undefined;
    asianStrings?:
      | GraphQLTypes['AudioAnalysisInstrumentPresenceLabel']
      | undefined;
    luteOud?: GraphQLTypes['AudioAnalysisInstrumentPresenceLabel'] | undefined;
  };
  ['AudioAnalysisV7Genre']: {
    __typename: 'AudioAnalysisV7Genre';
    /** Mean prediction value for the "afro" genre. */
    afro?: number | undefined;
    /** Mean prediction value for the "ambient" genre. */
    ambient?: number | undefined;
    /** Mean prediction value for the "arab" genre. */
    arab?: number | undefined;
    /** Mean prediction value for the "asian" genre. */
    asian?: number | undefined;
    /** Mean prediction value for the "blues" genre. */
    blues?: number | undefined;
    /** Mean prediction value for the "children jingle" genre. */
    childrenJingle?: number | undefined;
    /** Mean prediction value for the "classical" genre. */
    classical?: number | undefined;
    /** Mean prediction value for the "electronic dance" genre. */
    electronicDance?: number | undefined;
    /** Mean prediction value for the "folk country" genre. */
    folkCountry?: number | undefined;
    /** Mean prediction value for the "funk soul" genre. */
    funkSoul?: number | undefined;
    /** Mean prediction value for the "indian" genre. */
    indian?: number | undefined;
    /** Mean prediction value for the "jazz" genre. */
    jazz?: number | undefined;
    /** Mean prediction value for the "latin" genre. */
    latin?: number | undefined;
    /** Mean prediction value for the "metal" genre. */
    metal?: number | undefined;
    /** Mean prediction value for the "pop" genre. */
    pop?: number | undefined;
    /** Mean prediction value for the "rap hip hop" genre. */
    rapHipHop?: number | undefined;
    /** Mean prediction value for the "reggae" genre. */
    reggae?: number | undefined;
    /** Mean prediction value for the "rnb" genre. */
    rnb?: number | undefined;
    /** Mean prediction value for the "rock" genre. */
    rock?: number | undefined;
    /** Mean prediction value for the "singer songwriters" genre. */
    singerSongwriters?: number | undefined;
    /** Mean prediction value for the "sound" genre. */
    sound?: number | undefined;
    /** Mean prediction value for the "soundtrack" genre. */
    soundtrack?: number | undefined;
    /** Mean prediction value for the "spoken word" genre. */
    spokenWord?: number | undefined;
  };
  ['AudioAnalysisV7GenreTags']: AudioAnalysisV7GenreTags;
  ['AudioAnalysisV7GenreSegments']: {
    __typename: 'AudioAnalysisV7GenreSegments';
    /** Segments prediction value for the "afro" genre */
    afro: Array<number>;
    /** Segments prediction value for the "ambient" genre */
    ambient: Array<number>;
    /** Segments prediction value for the "arab" genre */
    arab: Array<number>;
    /** Segments prediction value for the "asian" genre */
    asian: Array<number>;
    /** Segments prediction value for the "blues" genre */
    blues: Array<number>;
    /** Segments prediction value for the "childrenJingle" genre */
    childrenJingle: Array<number>;
    /** Segments prediction value for the "classical" genre */
    classical: Array<number>;
    /** Segments prediction value for the "electronicDance" genre */
    electronicDance: Array<number>;
    /** Segments prediction value for the "folkCountry" genre */
    folkCountry: Array<number>;
    /** Segments prediction value for the "funkSoul" genre */
    funkSoul: Array<number>;
    /** Segments prediction value for the "indian" genre */
    indian: Array<number>;
    /** Segments prediction value for the "jazz" genre */
    jazz: Array<number>;
    /** Segments prediction value for the "latin" genre */
    latin: Array<number>;
    /** Segments prediction value for the "metal" genre */
    metal: Array<number>;
    /** Segments prediction value for the "pop" genre */
    pop: Array<number>;
    /** Segments prediction value for the "rapHipHop" genre */
    rapHipHop: Array<number>;
    /** Segments prediction value for the "reggae" genre */
    reggae: Array<number>;
    /** Segments prediction value for the "rnb" genre */
    rnb: Array<number>;
    /** Segments prediction value for the "rock" genre */
    rock: Array<number>;
    /** Segments prediction value for the "singerSongwriters" genre */
    singerSongwriters: Array<number>;
    /** Segments prediction value for the "sound" genre */
    sound: Array<number>;
    /** Segments prediction value for the "soundtrack" genre */
    soundtrack: Array<number>;
    /** Segments prediction value for the "spokenWord" genre */
    spokenWord: Array<number>;
  };
  ['AudioAnalysisV7SubgenreSegments']: {
    __typename: 'AudioAnalysisV7SubgenreSegments';
    /** Segments prediction value for the "bluesRock" sub-genre. */
    bluesRock?: Array<number> | undefined;
    /** Segments prediction value for the "folkRock" sub-genre. */
    folkRock?: Array<number> | undefined;
    /** Segments prediction value for the "hardRock" sub-genre. */
    hardRock?: Array<number> | undefined;
    /** Segments prediction value for the "indieAlternative" sub-genre. */
    indieAlternative?: Array<number> | undefined;
    /** Segments prediction value for the "psychedelicProgressiveRock" sub-genre. */
    psychedelicProgressiveRock?: Array<number> | undefined;
    /** Segments prediction value for the "punk" sub-genre. */
    punk?: Array<number> | undefined;
    /** Segments prediction value for the "rockAndRoll" sub-genre. */
    rockAndRoll?: Array<number> | undefined;
    /** Segments prediction value for the "popSoftRock" sub-genre. */
    popSoftRock?: Array<number> | undefined;
    /** Segments prediction value for the "abstractIDMLeftfield" sub-genre. */
    abstractIDMLeftfield?: Array<number> | undefined;
    /** Segments prediction value for the "breakbeatDnB" sub-genre. */
    breakbeatDnB?: Array<number> | undefined;
    /** Segments prediction value for the "deepHouse" sub-genre. */
    deepHouse?: Array<number> | undefined;
    /** Segments prediction value for the "electro" sub-genre. */
    electro?: Array<number> | undefined;
    /** Segments prediction value for the "house" sub-genre. */
    house?: Array<number> | undefined;
    /** Segments prediction value for the "minimal" sub-genre. */
    minimal?: Array<number> | undefined;
    /** Segments prediction value for the "synthPop" sub-genre. */
    synthPop?: Array<number> | undefined;
    /** Segments prediction value for the "techHouse" sub-genre. */
    techHouse?: Array<number> | undefined;
    /** Segments prediction value for the "techno" sub-genre. */
    techno?: Array<number> | undefined;
    /** Segments prediction value for the "trance" sub-genre. */
    trance?: Array<number> | undefined;
    /** Segments prediction value for the "contemporaryRnB" sub-genre. */
    contemporaryRnB?: Array<number> | undefined;
    /** Segments prediction value for the "gangsta" sub-genre. */
    gangsta?: Array<number> | undefined;
    /** Segments prediction value for the "jazzyHipHop" sub-genre. */
    jazzyHipHop?: Array<number> | undefined;
    /** Segments prediction value for the "popRap" sub-genre. */
    popRap?: Array<number> | undefined;
    /** Segments prediction value for the "trap" sub-genre. */
    trap?: Array<number> | undefined;
    /** Segments prediction value for the "blackMetal" sub-genre. */
    blackMetal?: Array<number> | undefined;
    /** Segments prediction value for the "deathMetal" sub-genre. */
    deathMetal?: Array<number> | undefined;
    /** Segments prediction value for the "doomMetal" sub-genre. */
    doomMetal?: Array<number> | undefined;
    /** Segments prediction value for the "heavyMetal" sub-genre. */
    heavyMetal?: Array<number> | undefined;
    /** Segments prediction value for the "metalcore" sub-genre. */
    metalcore?: Array<number> | undefined;
    /** Segments prediction value for the "nuMetal" sub-genre. */
    nuMetal?: Array<number> | undefined;
    /** Segments prediction value for the "disco" sub-genre. */
    disco?: Array<number> | undefined;
    /** Segments prediction value for the "funk" sub-genre. */
    funk?: Array<number> | undefined;
    /** Segments prediction value for the "gospel" sub-genre. */
    gospel?: Array<number> | undefined;
    /** Segments prediction value for the "neoSoul" sub-genre. */
    neoSoul?: Array<number> | undefined;
    /** Segments prediction value for the "soul" sub-genre. */
    soul?: Array<number> | undefined;
    /** Segments prediction value for the "bigBandSwing" sub-genre. */
    bigBandSwing?: Array<number> | undefined;
    /** Segments prediction value for the "bebop" sub-genre. */
    bebop?: Array<number> | undefined;
    /** Segments prediction value for the "contemporaryJazz" sub-genre. */
    contemporaryJazz?: Array<number> | undefined;
    /** Segments prediction value for the "easyListening" sub-genre. */
    easyListening?: Array<number> | undefined;
    /** Segments prediction value for the "fusion" sub-genre. */
    fusion?: Array<number> | undefined;
    /** Segments prediction value for the "latinJazz" sub-genre. */
    latinJazz?: Array<number> | undefined;
    /** Segments prediction value for the "smoothJazz" sub-genre. */
    smoothJazz?: Array<number> | undefined;
    /** Segments prediction value for the "country" sub-genre. */
    country?: Array<number> | undefined;
    /** Segments prediction value for the "folk" sub-genre. */
    folk?: Array<number> | undefined;
  };
  ['AudioAnalysisV7SubgenreTags']: AudioAnalysisV7SubgenreTags;
  ['AudioAnalysisV7Subgenre']: {
    __typename: 'AudioAnalysisV7Subgenre';
    /** Mean prediction value for the "bluesRock" sub-genre. */
    bluesRock?: number | undefined;
    /** Mean prediction value for the "folkRock" sub-genre. */
    folkRock?: number | undefined;
    /** Mean prediction value for the "hardRock" sub-genre. */
    hardRock?: number | undefined;
    /** Mean prediction value for the "indieAlternative" sub-genre. */
    indieAlternative?: number | undefined;
    /** Mean prediction value for the "psychedelicProgressiveRock" sub-genre. */
    psychedelicProgressiveRock?: number | undefined;
    /** Mean prediction value for the "punk" sub-genre. */
    punk?: number | undefined;
    /** Mean prediction value for the "rockAndRoll" sub-genre. */
    rockAndRoll?: number | undefined;
    /** Mean prediction value for the "popSoftRock" sub-genre. */
    popSoftRock?: number | undefined;
    /** Mean prediction value for the "abstractIDMLeftfield" sub-genre. */
    abstractIDMLeftfield?: number | undefined;
    /** Mean prediction value for the "breakbeatDnB" sub-genre. */
    breakbeatDnB?: number | undefined;
    /** Mean prediction value for the "deepHouse" sub-genre. */
    deepHouse?: number | undefined;
    /** Mean prediction value for the "electro" sub-genre. */
    electro?: number | undefined;
    /** Mean prediction value for the "house" sub-genre. */
    house?: number | undefined;
    /** Mean prediction value for the "minimal" sub-genre. */
    minimal?: number | undefined;
    /** Mean prediction value for the "synthPop" sub-genre. */
    synthPop?: number | undefined;
    /** Mean prediction value for the "techHouse" sub-genre. */
    techHouse?: number | undefined;
    /** Mean prediction value for the "techno" sub-genre. */
    techno?: number | undefined;
    /** Mean prediction value for the "trance" sub-genre. */
    trance?: number | undefined;
    /** Mean prediction value for the "contemporaryRnB" sub-genre. */
    contemporaryRnB?: number | undefined;
    /** Mean prediction value for the "gangsta" sub-genre. */
    gangsta?: number | undefined;
    /** Mean prediction value for the "jazzyHipHop" sub-genre. */
    jazzyHipHop?: number | undefined;
    /** Mean prediction value for the "popRap" sub-genre. */
    popRap?: number | undefined;
    /** Mean prediction value for the "trap" sub-genre. */
    trap?: number | undefined;
    /** Mean prediction value for the "blackMetal" sub-genre. */
    blackMetal?: number | undefined;
    /** Mean prediction value for the "deathMetal" sub-genre. */
    deathMetal?: number | undefined;
    /** Mean prediction value for the "doomMetal" sub-genre. */
    doomMetal?: number | undefined;
    /** Mean prediction value for the "heavyMetal" sub-genre. */
    heavyMetal?: number | undefined;
    /** Mean prediction value for the "metalcore" sub-genre. */
    metalcore?: number | undefined;
    /** Mean prediction value for the "nuMetal" sub-genre. */
    nuMetal?: number | undefined;
    /** Mean prediction value for the "disco" sub-genre. */
    disco?: number | undefined;
    /** Mean prediction value for the "funk" sub-genre. */
    funk?: number | undefined;
    /** Mean prediction value for the "gospel" sub-genre. */
    gospel?: number | undefined;
    /** Mean prediction value for the "neoSoul" sub-genre. */
    neoSoul?: number | undefined;
    /** Mean prediction value for the "soul" sub-genre. */
    soul?: number | undefined;
    /** Mean prediction value for the "bigBandSwing" sub-genre. */
    bigBandSwing?: number | undefined;
    /** Mean prediction value for the "bebop" sub-genre. */
    bebop?: number | undefined;
    /** Mean prediction value for the "contemporaryJazz" sub-genre. */
    contemporaryJazz?: number | undefined;
    /** Mean prediction value for the "easyListening" sub-genre. */
    easyListening?: number | undefined;
    /** Mean prediction value for the "fusion" sub-genre. */
    fusion?: number | undefined;
    /** Mean prediction value for the "latinJazz" sub-genre. */
    latinJazz?: number | undefined;
    /** Mean prediction value for the "smoothJazz" sub-genre. */
    smoothJazz?: number | undefined;
    /** Mean prediction value for the "country" sub-genre. */
    country?: number | undefined;
    /** Mean prediction value for the "folk" sub-genre. */
    folk?: number | undefined;
  };
  ['AudioAnalysisV6Result']: {
    __typename: 'AudioAnalysisV6Result';
    /** The prediction results for the segments of the audio. */
    segments?: GraphQLTypes['AudioAnalysisV6Segments'] | undefined;
    /** The multi-label genre prediction for the whole audio. */
    genre?: GraphQLTypes['AudioAnalysisV6Genre'] | undefined;
    genreTags?: Array<GraphQLTypes['AudioAnalysisV6GenreTags']> | undefined;
    /** The multi-label subgenre prediction for the whole audio. */
    subgenre?: GraphQLTypes['AudioAnalysisV6Subgenre'] | undefined;
    /** List of subgenre tags the audio is classified with. */
    subgenreTags?:
      | Array<GraphQLTypes['AudioAnalysisV6SubgenreTags']>
      | undefined;
    subgenreEdm?: GraphQLTypes['AudioAnalysisV6SubgenreEdm'] | undefined;
    subgenreEdmTags?:
      | Array<GraphQLTypes['AudioAnalysisV6SubgenreEdmTags']>
      | undefined;
    /** The multi-label mood prediction for the whole audio. */
    mood?: GraphQLTypes['AudioAnalysisV6Mood'] | undefined;
    /** List of mood tags the audio is classified with. */
    moodTags?: Array<GraphQLTypes['AudioAnalysisV6MoodTags']> | undefined;
    moodMaxTimes?:
      | Array<GraphQLTypes['AudioAnalysisV6MaximumMoodInterval']>
      | undefined;
    voice?: GraphQLTypes['AudioAnalysisV6Voice'] | undefined;
    instruments?: GraphQLTypes['AudioAnalysisV6Instruments'] | undefined;
    /** The presence of instruments of the audio. */
    instrumentPresence?:
      | GraphQLTypes['AudioAnalysisV6InstrumentPresence']
      | undefined;
    /** List of instrument tags the audio is classified with. */
    instrumentTags?:
      | Array<GraphQLTypes['AudioAnalysisV6InstrumentTags']>
      | undefined;
    /** BPM of the track. */
    bpm?: number | undefined;
    /** BPM predicted for the track. */
    bpmPrediction?: GraphQLTypes['AudioAnalysisV6BPMPrediction'] | undefined;
    /** The global estimated bpm value of the full track fixed to a custom range of 60-180 bpm. */
    bpmRangeAdjusted?: number | undefined;
    /** The key predicted for the track. */
    key?: GraphQLTypes['MusicalKey'] | undefined;
    /** The key predicted for the track. */
    keyPrediction?: GraphQLTypes['AudioAnalysisV6KeyPrediction'] | undefined;
    /** Time signature of the track. */
    timeSignature?: string | undefined;
    /** The overall valance of the audio. */
    valence?: number | undefined;
    /** The overall arousal of the audio. */
    arousal?: number | undefined;
    /** The overall energy level of the audio. */
    energyLevel?: GraphQLTypes['AudioAnalysisV6EnergyLevel'] | undefined;
    /** The overall energy dynamics of the audio. */
    energyDynamics?: GraphQLTypes['AudioAnalysisV6EnergyDynamics'] | undefined;
    /** The overall emotional profile of the audio. */
    emotionalProfile?:
      | GraphQLTypes['AudioAnalysisV6EmotionalProfile']
      | undefined;
    /** The overall voice presence profile of the audio. */
    voicePresenceProfile?:
      | GraphQLTypes['AudioAnalysisV6VoicePresenceProfile']
      | undefined;
    /** The overall emotional dynamics of the audio. */
    emotionalDynamics?:
      | GraphQLTypes['AudioAnalysisV6EmotionalDynamics']
      | undefined;
    /** The predominant voice gender of the audio. */
    predominantVoiceGender?:
      | GraphQLTypes['AudioAnalysisV6PredominantVoiceGender']
      | undefined;
    /** The predicted musical era of the audio. */
    musicalEraTag?: string | undefined;
    voiceTags?: Array<GraphQLTypes['AudioAnalysisV6VoiceTags']> | undefined;
    moodAdvanced?: GraphQLTypes['AudioAnalysisV6MoodAdvanced'] | undefined;
    moodAdvancedTags?:
      | Array<GraphQLTypes['AudioAnalysisV6MoodAdvancedTags']>
      | undefined;
    movement?: GraphQLTypes['AudioAnalysisV6Movement'] | undefined;
    movementTags?:
      | Array<GraphQLTypes['AudioAnalysisV6MovementTags']>
      | undefined;
    character?: GraphQLTypes['AudioAnalysisV6Character'] | undefined;
    characterTags?:
      | Array<GraphQLTypes['AudioAnalysisV6CharacterTags']>
      | undefined;
    /** This field is only available for music classified as classical. */
    classicalEpoch?: GraphQLTypes['AudioAnalysisV6ClassicalEpoch'] | undefined;
    /** This field is only available for music classified as classical. */
    classicalEpochTags?:
      | Array<GraphQLTypes['AudioAnalysisV6ClassicalEpochTags']>
      | undefined;
    transformerCaption?: string | undefined;
    /** The multi-label genre prediction for the whole audio. */
    advancedGenre?: GraphQLTypes['AudioAnalysisV7Genre'] | undefined;
    advancedGenreTags?:
      | Array<GraphQLTypes['AudioAnalysisV7GenreTags']>
      | undefined;
    /** The multi-label subgenre prediction for the whole audio. */
    advancedSubgenre?: GraphQLTypes['AudioAnalysisV7Subgenre'] | undefined;
    /** List of subgenre tags the audio is classified with. */
    advancedSubgenreTags?:
      | Array<GraphQLTypes['AudioAnalysisV7SubgenreTags']>
      | undefined;
    /** The presence of instruments of the audio. */
    advancedInstrumentPresence?:
      | GraphQLTypes['AudioAnalysisV7InstrumentPresence']
      | undefined;
    /** List of instrument tags the audio is classified with. */
    advancedInstrumentTags?:
      | Array<GraphQLTypes['AudioAnalysisV7InstrumentTags']>
      | undefined;
    /** The presence of instruments of the audio. */
    advancedInstrumentPresenceExtended?:
      | GraphQLTypes['AudioAnalysisV7ExtendedInstrumentPresence']
      | undefined;
    /** List of instrument tags the audio is classified with. */
    advancedInstrumentTagsExtended?:
      | Array<GraphQLTypes['AudioAnalysisV7ExtendedInstrumentTags']>
      | undefined;
    /** The existence of the voiceover in this track */
    voiceoverExists?: boolean | undefined;
    /** The degree of certainty that there is a voiceover */
    voiceoverDegree?: number | undefined;
    freeGenreTags?: string | undefined;
  };
  ['LibraryTrack']: {
    __typename: 'LibraryTrack';
    audioAnalysisV6: GraphQLTypes['AudioAnalysisV6'];
    /** The primary identifier. */
    id: string;
    /** The title of the track.
Can be specified when creating the track. */
    title: string;
    /** An optional external identifier
Can be specified when creating the track. */
    externalId?: string | undefined;
    /** Similar tracks from the own library. */
    similarLibraryTracks: GraphQLTypes['SimilarLibraryTracksResult'];
    /** Find similar tracks. */
    similarTracks: GraphQLTypes['SimilarTracksResult'];
    /** Augmented keywords that can be associated with the audio. */
    augmentedKeywords: GraphQLTypes['AugmentedKeywordsResult'];
    /** Brand values that can be associated with the audio. */
    brandValues: GraphQLTypes['BrandValuesResult'];
  };
  /** Represents a track on Spotify. */
  ['SpotifyTrack']: {
    __typename: 'SpotifyTrack';
    audioAnalysisV6: GraphQLTypes['AudioAnalysisV6'];
    /** The ID of the track on Spotify. It can be used for fetching additional information for the Spotify API.
For further information check out the Spotify Web API Documentation. https://developer.spotify.com/documentation/web-api/ */
    id: string;
    title: string;
    /** Find similar tracks. */
    similarTracks: GraphQLTypes['SimilarTracksResult'];
    /** Augmented keywords that can be associated with the audio. */
    augmentedKeywords: GraphQLTypes['AugmentedKeywordsResult'];
    /** Brand values that can be associated with the audio. */
    brandValues: GraphQLTypes['BrandValuesResult'];
  };
  ['LibraryTrackNotFoundError']: {
    __typename: 'LibraryTrackNotFoundError';
    message: string;
  };
  ['LibraryTrackResult']: {
    __typename: 'LibraryTrackNotFoundError' | 'LibraryTrack';
    ['...on LibraryTrackNotFoundError']: '__union' &
      GraphQLTypes['LibraryTrackNotFoundError'];
    ['...on LibraryTrack']: '__union' & GraphQLTypes['LibraryTrack'];
  };
  ['LibraryTrackEdge']: {
    __typename: 'LibraryTrackEdge';
    cursor: string;
    node: GraphQLTypes['LibraryTrack'];
  };
  ['LibraryTrackConnection']: {
    __typename: 'LibraryTrackConnection';
    edges: Array<GraphQLTypes['LibraryTrackEdge']>;
    pageInfo: GraphQLTypes['PageInfo'];
  };
  /** An error code returned when there is a problem with retrieving similar tracks. */
  ['SimilarLibraryTracksErrorCode']: SimilarLibraryTracksErrorCode;
  /** An error object returned if an error occurred while retrieving similar tracks. */
  ['SimilarLibraryTracksError']: {
    __typename: 'SimilarLibraryTracksError';
    message: string;
    code: GraphQLTypes['SimilarLibraryTracksErrorCode'];
  };
  /** Describes the possible types the 'LibraryTrack.similarLibraryTracks' field can return. */
  ['SimilarLibraryTracksResult']: {
    __typename: 'SimilarLibraryTracksError' | 'SimilarLibraryTrackConnection';
    ['...on SimilarLibraryTracksError']: '__union' &
      GraphQLTypes['SimilarLibraryTracksError'];
    ['...on SimilarLibraryTrackConnection']: '__union' &
      GraphQLTypes['SimilarLibraryTrackConnection'];
  };
  /** Filter the LibraryTrackConnection. @oneOf */
  ['LibraryTracksFilter']: {
    /** Find library tracks whose title includes a specific substring. */
    title?: string | undefined;
    /** Find library tracks whose source audio file sha256 hash matches. */
    sha256?: string | undefined;
    /** Find library tracks whose external id matches. */
    externalId?: string | undefined;
  };
  ['CratesConnection']: {
    __typename: 'CratesConnection';
    edges: Array<GraphQLTypes['CrateEdge']>;
    pageInfo: GraphQLTypes['PageInfo'];
  };
  ['CrateEdge']: {
    __typename: 'CrateEdge';
    cursor: string;
    node: GraphQLTypes['Crate'];
  };
  /** A type representing a crate on the Cyanite platform. */
  ['Crate']: {
    __typename: 'Crate';
    id: string;
    name: string;
  };
  /** Error codes that can be returned by the 'crateCreate' mutation. */
  ['CrateCreateErrorCode']: CrateCreateErrorCode;
  /** An error object returned if an error occurred while creating a crate. */
  ['CrateCreateError']: {
    __typename: 'CrateCreateError';
    message: string;
    code: GraphQLTypes['CrateCreateErrorCode'];
  };
  /** Input for 'crateDelete' Mutation. */
  ['CrateDeleteInput']: {
    /** Id of the crate that will be deleted. */
    id: string;
  };
  /** Input for 'crateCreate' Mutation. */
  ['CrateCreateInput']: {
    /** The name of the crate to be created. */
    name: string;
  };
  /** Input for 'crateAddLibraryTracks' Mutation. */
  ['CrateAddLibraryTracksInput']: {
    /** Tracks that will be put into the crate. */
    libraryTrackIds: Array<string>;
    /** Target crate id. */
    crateId: string;
  };
  /** Input for 'crateRemoveLibraryTracks' Mutation. */
  ['CrateRemoveLibraryTracksInput']: {
    /** Tracks that will be removed from the crate. */
    libraryTrackIds: Array<string>;
    /** Target crate id. */
    crateId: string;
  };
  /** Describes the possible types that the 'crateCreate' Mutation can return. */
  ['CrateCreateResult']: {
    __typename: 'CrateCreateSuccess' | 'CrateCreateError';
    ['...on CrateCreateSuccess']: '__union' &
      GraphQLTypes['CrateCreateSuccess'];
    ['...on CrateCreateError']: '__union' & GraphQLTypes['CrateCreateError'];
  };
  /** The crate was created successfully. */
  ['CrateCreateSuccess']: {
    __typename: 'CrateCreateSuccess';
    /** Id of the newly created crate. */
    id: string;
  };
  /** Describes the possible types that the 'crateDelete' Mutation can return. */
  ['CrateDeleteResult']: {
    __typename: 'CrateDeleteSuccess' | 'CrateDeleteError';
    ['...on CrateDeleteSuccess']: '__union' &
      GraphQLTypes['CrateDeleteSuccess'];
    ['...on CrateDeleteError']: '__union' & GraphQLTypes['CrateDeleteError'];
  };
  /** The crate was deleted successfully. */
  ['CrateDeleteSuccess']: {
    __typename: 'CrateDeleteSuccess';
    _?: boolean | undefined;
  };
  /** Error codes that can be returned by the 'crateDelete' Mutation. */
  ['CrateDeleteErrorCode']: CrateDeleteErrorCode;
  /** An error object returned if an error occurred while deleting a crate. */
  ['CrateDeleteError']: {
    __typename: 'CrateDeleteError';
    message: string;
    code: GraphQLTypes['CrateDeleteErrorCode'];
  };
  /** Describes the possible types that the 'crateAddLibraryTracks' Mutation can return. */
  ['CrateAddLibraryTracksResult']: {
    __typename: 'CrateAddLibraryTracksSuccess' | 'CrateAddLibraryTracksError';
    ['...on CrateAddLibraryTracksSuccess']: '__union' &
      GraphQLTypes['CrateAddLibraryTracksSuccess'];
    ['...on CrateAddLibraryTracksError']: '__union' &
      GraphQLTypes['CrateAddLibraryTracksError'];
  };
  /** The tracks were successfully added to the crate. */
  ['CrateAddLibraryTracksSuccess']: {
    __typename: 'CrateAddLibraryTracksSuccess';
    /** The IDs of the library tracks that were added to the crate. */
    addedLibraryTrackIds: Array<string>;
  };
  /** An error object returned if an error occurred while adding the tracks to the crate. */
  ['CrateAddLibraryTracksError']: {
    __typename: 'CrateAddLibraryTracksError';
    message: string;
    code: GraphQLTypes['CrateAddLibraryTracksErrorCode'];
  };
  /** Error codes that can be returned by the 'crateAddLibraryTracks' Mutation. */
  ['CrateAddLibraryTracksErrorCode']: CrateAddLibraryTracksErrorCode;
  /** Describes the possible types that the 'crateRemoveLibraryTracks' Mutation can return. */
  ['CrateRemoveLibraryTracksResult']: {
    __typename:
      | 'CrateRemoveLibraryTracksSuccess'
      | 'CrateRemoveLibraryTracksError';
    ['...on CrateRemoveLibraryTracksSuccess']: '__union' &
      GraphQLTypes['CrateRemoveLibraryTracksSuccess'];
    ['...on CrateRemoveLibraryTracksError']: '__union' &
      GraphQLTypes['CrateRemoveLibraryTracksError'];
  };
  /** The tracks were successfully removed from the crate. */
  ['CrateRemoveLibraryTracksSuccess']: {
    __typename: 'CrateRemoveLibraryTracksSuccess';
    /** The IDs of the library tracks that were removed from the crate. */
    removedLibraryTrackIds: Array<string>;
  };
  /** Error codes that can be returned by the 'crateRemoveLibraryTracks' Mutation. */
  ['CrateRemoveLibraryTracksError']: {
    __typename: 'CrateRemoveLibraryTracksError';
    message: string;
    code: GraphQLTypes['CrateRemoveLibraryTracksErrorCode'];
  };
  /** Error codes that can be returned by the 'crateRemoveLibraryTracks' Mutation. */
  ['CrateRemoveLibraryTracksErrorCode']: CrateRemoveLibraryTracksErrorCode;
  ['LibraryTrackCreateInput']: {
    /** The id of the upload requested via the 'fileUploadRequest' Mutation. */
    uploadId: string;
    /** An optional title that is set for the 'LibraryTrack'.
The character limit for the title is 150. */
    title?: string | undefined;
    /** An optional external identifier that is set for the 'LibraryTrack'.
The character limit for the external id is 150. */
    externalId?: string | undefined;
  };
  /** Describes a successful LibraryTrack creation. */
  ['LibraryTrackCreateSuccess']: {
    __typename: 'LibraryTrackCreateSuccess';
    /** The newly created LibraryTrack. */
    createdLibraryTrack: GraphQLTypes['LibraryTrack'];
    /** Whether the track was enqueued successfully or not. */
    enqueueResult: GraphQLTypes['LibraryTrackEnqueueResult'];
  };
  ['LibraryTrackCreateErrorCode']: LibraryTrackCreateErrorCode;
  /** Describes a failed LibraryTrack creation. */
  ['LibraryTrackCreateError']: {
    __typename: 'LibraryTrackCreateError';
    /** An error that describes the reason for the failed LibraryTrack creation. */
    code: GraphQLTypes['LibraryTrackCreateErrorCode'];
    /** A human readable message that describes the reason for the failed LibraryTrack creation. */
    message: string;
  };
  /** Describes the possible types the 'libraryTrackCreate' Mutation can return. */
  ['LibraryTrackCreateResult']: {
    __typename: 'LibraryTrackCreateSuccess' | 'LibraryTrackCreateError';
    ['...on LibraryTrackCreateSuccess']: '__union' &
      GraphQLTypes['LibraryTrackCreateSuccess'];
    ['...on LibraryTrackCreateError']: '__union' &
      GraphQLTypes['LibraryTrackCreateError'];
  };
  ['LibraryTrackEnqueueSuccess']: {
    __typename: 'LibraryTrackEnqueueSuccess';
    enqueuedLibraryTrack: GraphQLTypes['LibraryTrack'];
  };
  ['LibraryTrackEnqueueErrorCode']: LibraryTrackEnqueueErrorCode;
  ['LibraryTrackEnqueueError']: {
    __typename: 'LibraryTrackEnqueueError';
    /** An error that describes the reason for the failed LibraryTrack creation. */
    code: GraphQLTypes['LibraryTrackEnqueueErrorCode'];
    /** A human readable message that describes the reason for the failed LibraryTrack creation. */
    message: string;
  };
  ['LibraryTrackEnqueueResult']: {
    __typename: 'LibraryTrackEnqueueSuccess' | 'LibraryTrackEnqueueError';
    ['...on LibraryTrackEnqueueSuccess']: '__union' &
      GraphQLTypes['LibraryTrackEnqueueSuccess'];
    ['...on LibraryTrackEnqueueError']: '__union' &
      GraphQLTypes['LibraryTrackEnqueueError'];
  };
  ['LibraryTrackEnqueueInput']: {
    /** The id of the LibraryTrack that should be enqueued. */
    libraryTrackId: string;
  };
  /** Describes the possible types the 'libraryTracksDelete' Mutation can return. */
  ['LibraryTracksDeleteResult']: {
    __typename: 'LibraryTracksDeleteSuccess' | 'LibraryTracksDeleteError';
    ['...on LibraryTracksDeleteSuccess']: '__union' &
      GraphQLTypes['LibraryTracksDeleteSuccess'];
    ['...on LibraryTracksDeleteError']: '__union' &
      GraphQLTypes['LibraryTracksDeleteError'];
  };
  ['LibraryTracksDeleteErrorCode']: LibraryTracksDeleteErrorCode;
  ['LibraryTracksDeleteError']: {
    __typename: 'LibraryTracksDeleteError';
    /** Error code. */
    code: GraphQLTypes['LibraryTracksDeleteErrorCode'];
    /** A human readable message that describes why the operation has failed. */
    message: string;
  };
  ['LibraryTracksDeleteSuccess']: {
    __typename: 'LibraryTracksDeleteSuccess';
    /** The IDs of deleted LibraryTracks. */
    libraryTrackIds: Array<string>;
  };
  ['LibraryTracksDeleteInput']: {
    /** The IDs of the LibraryTracks that should be deleted. */
    libraryTrackIds: Array<string>;
  };
  ['YouTubeTrackEnqueueResult']: {
    __typename: 'YouTubeTrackEnqueueError' | 'YouTubeTrackEnqueueSuccess';
    ['...on YouTubeTrackEnqueueError']: '__union' &
      GraphQLTypes['YouTubeTrackEnqueueError'];
    ['...on YouTubeTrackEnqueueSuccess']: '__union' &
      GraphQLTypes['YouTubeTrackEnqueueSuccess'];
  };
  ['YouTubeTrackEnqueueErrorCode']: YouTubeTrackEnqueueErrorCode;
  ['YouTubeTrackEnqueueError']: {
    __typename: 'YouTubeTrackEnqueueError';
    /** A human readable message that describes why the operation has failed. */
    message: string;
    /** Error code if applicable */
    code: GraphQLTypes['YouTubeTrackEnqueueErrorCode'];
  };
  ['YouTubeTrackEnqueueSuccess']: {
    __typename: 'YouTubeTrackEnqueueSuccess';
    enqueuedLibraryTrack: GraphQLTypes['LibraryTrack'];
  };
  ['YouTubeTrackEnqueueInput']: {
    /** YouTube video URL */
    videoUrl: string;
  };
  ['SpotifyTrackError']: {
    __typename: 'SpotifyTrackError';
    message: string;
  };
  ['SpotifyTrackResult']: {
    __typename: 'SpotifyTrackError' | 'SpotifyTrack';
    ['...on SpotifyTrackError']: '__union' & GraphQLTypes['SpotifyTrackError'];
    ['...on SpotifyTrack']: '__union' & GraphQLTypes['SpotifyTrack'];
  };
  ['SpotifyTrackEnqueueInput']: {
    spotifyTrackId: string;
  };
  ['SpotifyTrackEnqueueError']: {
    __typename: 'SpotifyTrackEnqueueError';
    message: string;
  };
  ['SpotifyTrackEnqueueSuccess']: {
    __typename: 'SpotifyTrackEnqueueSuccess';
    enqueuedSpotifyTrack: GraphQLTypes['SpotifyTrack'];
  };
  ['SpotifyTrackEnqueueResult']: {
    __typename: 'SpotifyTrackEnqueueError' | 'SpotifyTrackEnqueueSuccess';
    ['...on SpotifyTrackEnqueueError']: '__union' &
      GraphQLTypes['SpotifyTrackEnqueueError'];
    ['...on SpotifyTrackEnqueueSuccess']: '__union' &
      GraphQLTypes['SpotifyTrackEnqueueSuccess'];
  };
  /** Possible error codes of 'Track.similarTracks'. */
  ['SimilarTracksErrorCode']: SimilarTracksErrorCode;
  /** An error object returned if an error occurred while performing a similarity search. */
  ['SimilarTracksError']: {
    __typename: 'SimilarTracksError';
    code: GraphQLTypes['SimilarTracksErrorCode'];
    message: string;
  };
  ['SimilarTracksEdge']: {
    __typename: 'SimilarTracksEdge';
    cursor: string;
    node: GraphQLTypes['Track'];
  };
  ['SimilarTracksConnection']: {
    __typename: 'SimilarTracksConnection';
    pageInfo: GraphQLTypes['PageInfo'];
    edges: Array<GraphQLTypes['SimilarTracksEdge']>;
  };
  /** Describes the possible types that the 'Track.similarTracks' field can return. */
  ['SimilarTracksResult']: {
    __typename: 'SimilarTracksError' | 'SimilarTracksConnection';
    ['...on SimilarTracksError']: '__union' &
      GraphQLTypes['SimilarTracksError'];
    ['...on SimilarTracksConnection']: '__union' &
      GraphQLTypes['SimilarTracksConnection'];
  };
  /** Musical keys */
  ['MusicalKey']: MusicalKey;
  /** List of musical genres. */
  ['MusicalGenre']: MusicalGenre;
  ['SimilarTracksSearchModeInterval']: {
    /** Start of the interval in seconds. */
    start: number;
    /** End of the interval in seconds. */
    end: number;
  };
  /** The search mode used for the similarity search.
Only one of the fields of this input type should be provided.
By default the 'mostRepresentative' mode will be used.

@oneOf */
  ['SimilarTracksSearchMode']: {
    /** Use the part of the track that is most representative as the criteria for finding similar tracks (Default mode). */
    mostRepresentative?: boolean | undefined;
    /** Use the complete track as the criteria for finding similar tracks. */
    complete?: boolean | undefined;
    /** Use the part of the track specified by the interval as the criteria for finding similar tracks. */
    interval?: GraphQLTypes['SimilarTracksSearchModeInterval'] | undefined;
  };
  /** Return similar tracks from a library. */
  ['SimilarTracksTargetLibrary']: {
    _?: boolean | undefined;
  };
  /** Return similar tracks from Spotify. */
  ['SimilarTracksTargetSpotify']: {
    _?: boolean | undefined;
  };
  /** Return similar tracks from a crate. */
  ['SimilarTracksTargetCrate']: {
    /** The crate id from which similar tracks should be returned. */
    crateId: string;
  };
  /** SimilarTracksTarget
Only one of the fields of this input type should be provided.
@oneOf */
  ['SimilarTracksTarget']: {
    /** Return LibraryTrack results. */
    library?: GraphQLTypes['SimilarTracksTargetLibrary'] | undefined;
    /** Return LibraryTracks from a specific crate. */
    crate?: GraphQLTypes['SimilarTracksTargetCrate'] | undefined;
    /** Return SpotifyTrack results. */
    spotify?: GraphQLTypes['SimilarTracksTargetSpotify'] | undefined;
  };
  ['experimental_SimilarTracksFilterBpmInput']: {
    _?: boolean | undefined;
  };
  ['experimental_SimilarTracksFilterBpmRange']: {
    start: number;
    end: number;
  };
  /** The BPM filter config.
Only one of the fields of this input type should be provided.
@oneOf */
  ['experimental_SimilarTracksFilterBpm']: {
    /** Use a BPM range around the input track (+-6%) */
    input?:
      | GraphQLTypes['experimental_SimilarTracksFilterBpmInput']
      | undefined;
    /** Use a custom BPM range */
    range?:
      | GraphQLTypes['experimental_SimilarTracksFilterBpmRange']
      | undefined;
  };
  ['experimental_SimilarTracksFilterGenreInput']: {
    _?: boolean | undefined;
  };
  /** The Genre filter config.
Only one of the fields of this input type should be provided.
@oneOf */
  ['experimental_SimilarTracksFilterGenre']: {
    /** Use a genre from the input track */
    input?:
      | GraphQLTypes['experimental_SimilarTracksFilterGenreInput']
      | undefined;
    /** Use a list of genres to filter for */
    list?: Array<GraphQLTypes['MusicalGenre']> | undefined;
  };
  ['experimental_SimilarTracksFilterKeyCamelotInput']: {
    _?: boolean | undefined;
  };
  /** The Camelot key filter config.
Only one of the fields of this input type should be provided.
SimilarTracksKeyFilter @oneOf */
  ['experimental_SimilarTracksFilterKeyCamelot']: {
    /** Use key from the input track. */
    input?:
      | GraphQLTypes['experimental_SimilarTracksFilterKeyCamelotInput']
      | undefined;
    /** Use custom key. */
    key?: GraphQLTypes['MusicalKey'] | undefined;
  };
  ['experimental_SimilarTracksFilterKeyMatchingInput']: {
    _?: boolean | undefined;
  };
  /** The key key filter config.
Only one of the fields of this input type should be provided.
SimilarTracksKeyFilter @oneOf */
  ['experimental_SimilarTracksFilterKeyMatching']: {
    /** Use key from the input track. */
    input?:
      | GraphQLTypes['experimental_SimilarTracksFilterKeyMatchingInput']
      | undefined;
    /** Use list of custom keys. */
    list?: Array<GraphQLTypes['MusicalKey']> | undefined;
  };
  /** The Key filter config.
Only one of the fields of this input type should be provided.
@oneOf */
  ['experimental_SimilarTracksFilterKey']: {
    /** When set, will use Camelot filtering. */
    camelot?:
      | GraphQLTypes['experimental_SimilarTracksFilterKeyCamelot']
      | undefined;
    /** When set, will use key filtering. */
    matching?:
      | GraphQLTypes['experimental_SimilarTracksFilterKeyMatching']
      | undefined;
  };
  /** Describes the possible filters that can be applied for the search. */
  ['experimental_SimilarTracksFilter']: {
    /** Filter the search results by a BPM range. */
    bpm?: GraphQLTypes['experimental_SimilarTracksFilterBpm'] | undefined;
    /** Filter the search results by a list of genres. */
    genre?: GraphQLTypes['experimental_SimilarTracksFilterGenre'] | undefined;
    /** Filter the search results by one of the possible key filters.
Default: no key filter applied */
    key?: GraphQLTypes['experimental_SimilarTracksFilterKey'] | undefined;
  };
  ['KeywordSearchKeyword']: {
    weight: number;
    keyword: string;
  };
  /** An error code returned when there is a problem with retrieving similar tracks. */
  ['KeywordSearchErrorCode']: KeywordSearchErrorCode;
  ['KeywordSearchError']: {
    __typename: 'KeywordSearchError';
    message: string;
    code: GraphQLTypes['KeywordSearchErrorCode'];
  };
  ['KeywordSearchResult']: {
    __typename: 'KeywordSearchConnection' | 'KeywordSearchError';
    ['...on KeywordSearchConnection']: '__union' &
      GraphQLTypes['KeywordSearchConnection'];
    ['...on KeywordSearchError']: '__union' &
      GraphQLTypes['KeywordSearchError'];
  };
  ['Keyword']: {
    __typename: 'Keyword';
    keyword: string;
  };
  ['KeywordEdge']: {
    __typename: 'KeywordEdge';
    node: GraphQLTypes['Keyword'];
    cursor: string;
  };
  ['KeywordConnection']: {
    __typename: 'KeywordConnection';
    pageInfo: GraphQLTypes['PageInfo'];
    edges: Array<GraphQLTypes['KeywordEdge']>;
  };
  /** Return tracks from a library. */
  ['KeywordSearchTargetLibrary']: {
    _?: boolean | undefined;
  };
  /** Return tracks from a crate. */
  ['KeywordSearchTargetCrate']: {
    /** The crate id from which tracks should be returned. */
    crateId: string;
  };
  /** Return similar tracks from Spotify. */
  ['KeywordSearchTargetSpotify']: {
    _?: boolean | undefined;
  };
  /** KeywordSearchTarget
Only one of the fields of this input type should be provided.
@oneOf */
  ['KeywordSearchTarget']: {
    /** Return LibraryTrack results. */
    library?: GraphQLTypes['KeywordSearchTargetLibrary'] | undefined;
    /** Return LibraryTracks from a specific crate. */
    crate?: GraphQLTypes['KeywordSearchTargetCrate'] | undefined;
    /** Return SpotifyTrack results. */
    spotify?: GraphQLTypes['KeywordSearchTargetSpotify'] | undefined;
  };
  ['KeywordSearchEdge']: {
    __typename: 'KeywordSearchEdge';
    node: GraphQLTypes['Track'];
    cursor: string;
  };
  ['KeywordSearchConnection']: {
    __typename: 'KeywordSearchConnection';
    pageInfo: GraphQLTypes['PageInfo'];
    edges: Array<GraphQLTypes['KeywordSearchEdge']>;
  };
  ['AugmentedKeyword']: {
    __typename: 'AugmentedKeyword';
    keyword: string;
    weight: number;
  };
  ['AugmentedKeywords']: {
    __typename: 'AugmentedKeywords';
    keywords: Array<GraphQLTypes['AugmentedKeyword']>;
  };
  ['AugmentedKeywordsErrorCode']: AugmentedKeywordsErrorCode;
  ['AugmentedKeywordsError']: {
    __typename: 'AugmentedKeywordsError';
    message: string;
    code: GraphQLTypes['AugmentedKeywordsErrorCode'];
  };
  ['AugmentedKeywordsResult']: {
    __typename: 'AugmentedKeywordsError' | 'AugmentedKeywords';
    ['...on AugmentedKeywordsError']: '__union' &
      GraphQLTypes['AugmentedKeywordsError'];
    ['...on AugmentedKeywords']: '__union' & GraphQLTypes['AugmentedKeywords'];
  };
  ['BrandValuesSuccess']: {
    __typename: 'BrandValuesSuccess';
    values: Array<string>;
  };
  ['SelectBrandValuesInput']: {
    /** Values must comply with available brand values */
    values: Array<string>;
  };
  ['SelectBrandValuesSuccess']: {
    __typename: 'SelectBrandValuesSuccess';
    success: boolean;
  };
  ['SelectBrandValuesResult']: {
    __typename: 'BrandValuesError' | 'SelectBrandValuesSuccess';
    ['...on BrandValuesError']: '__union' & GraphQLTypes['BrandValuesError'];
    ['...on SelectBrandValuesSuccess']: '__union' &
      GraphQLTypes['SelectBrandValuesSuccess'];
  };
  ['BrandValuesResult']: {
    __typename: 'BrandValuesError' | 'BrandValuesSuccess' | 'BrandValues';
    ['...on BrandValuesError']: '__union' & GraphQLTypes['BrandValuesError'];
    ['...on BrandValuesSuccess']: '__union' &
      GraphQLTypes['BrandValuesSuccess'];
    ['...on BrandValues']: '__union' & GraphQLTypes['BrandValues'];
  };
  ['BrandValue']: {
    __typename: 'BrandValue';
    value: string;
    weight: number;
  };
  ['BrandValues']: {
    __typename: 'BrandValues';
    values: Array<GraphQLTypes['BrandValue']>;
  };
  ['BrandValuesErrorCode']: BrandValuesErrorCode;
  ['BrandValuesError']: {
    __typename: 'BrandValuesError';
    message: string;
    code: GraphQLTypes['BrandValuesErrorCode'];
  };
  ['FreeTextSearchErrorCode']: FreeTextSearchErrorCode;
  ['FreeTextSearchTargetLibrary']: {
    libraryUserId?: string | undefined;
  };
  ['FreeTextSearchTargetCrate']: {
    crateId: string;
  };
  ['FreeTextSearchTargetSpotify']: {
    _?: boolean | undefined;
  };
  ['FreeTextSearchTarget']: {
    library?: GraphQLTypes['FreeTextSearchTargetLibrary'] | undefined;
    crate?: GraphQLTypes['FreeTextSearchTargetCrate'] | undefined;
    spotify?: GraphQLTypes['FreeTextSearchTargetSpotify'] | undefined;
  };
  ['FreeTextSearchError']: {
    __typename: 'FreeTextSearchError';
    code: GraphQLTypes['FreeTextSearchErrorCode'];
    message: string;
  };
  ['FreeTextSearchEdge']: {
    __typename: 'FreeTextSearchEdge';
    cursor: string;
    node: GraphQLTypes['Track'];
  };
  ['FreeTextSearchConnection']: {
    __typename: 'FreeTextSearchConnection';
    pageInfo: GraphQLTypes['PageInfo'];
    edges: Array<GraphQLTypes['FreeTextSearchEdge']>;
  };
  /** Describes the possible types that the 'freeTextSearch' field can return. */
  ['FreeTextSearchResult']: {
    __typename: 'FreeTextSearchError' | 'FreeTextSearchConnection';
    ['...on FreeTextSearchError']: '__union' &
      GraphQLTypes['FreeTextSearchError'];
    ['...on FreeTextSearchConnection']: '__union' &
      GraphQLTypes['FreeTextSearchConnection'];
  };
  ['LyricsSearchErrorCode']: LyricsSearchErrorCode;
  /** The Spotify target for lyrics search */
  ['LyricsSearchTargetSpotify']: {
    _?: boolean | undefined;
  };
  /** Search target to perform the lyrics search on. Currently only Spotify is available. */
  ['LyricsSearchTarget']: {
    spotify?: GraphQLTypes['LyricsSearchTargetSpotify'] | undefined;
  };
  /** Error type if search cannot be performed. Contains the code and a message. */
  ['LyricsSearchError']: {
    __typename: 'LyricsSearchError';
    code: GraphQLTypes['LyricsSearchErrorCode'];
    message: string;
  };
  /** The edge for lyrics search for cursor based pagination. */
  ['LyricsSearchEdge']: {
    __typename: 'LyricsSearchEdge';
    cursor: string;
    node: GraphQLTypes['Track'];
  };
  /** The connection for lyrics search for cursor based pagination. */
  ['LyricsSearchConnection']: {
    __typename: 'LyricsSearchConnection';
    pageInfo: GraphQLTypes['PageInfo'];
    edges: Array<GraphQLTypes['LyricsSearchEdge']>;
  };
  /** Describes the possible types that the 'lyricsSearch' field can return. */
  ['LyricsSearchResult']: {
    __typename: 'LyricsSearchError' | 'LyricsSearchConnection';
    ['...on LyricsSearchError']: '__union' & GraphQLTypes['LyricsSearchError'];
    ['...on LyricsSearchConnection']: '__union' &
      GraphQLTypes['LyricsSearchConnection'];
  };
};
export const enum AnalysisStatus {
  NOT_STARTED = 'NOT_STARTED',
  ENQUEUED = 'ENQUEUED',
  PROCESSING = 'PROCESSING',
  FINISHED = 'FINISHED',
  FAILED = 'FAILED',
}
export const enum EnergyLevel {
  variable = 'variable',
  medium = 'medium',
  high = 'high',
  low = 'low',
}
export const enum EnergyDynamics {
  low = 'low',
  medium = 'medium',
  high = 'high',
}
export const enum EmotionalProfile {
  variable = 'variable',
  negative = 'negative',
  neutral = 'neutral',
  positive = 'positive',
}
export const enum EmotionalDynamics {
  low = 'low',
  medium = 'medium',
  high = 'high',
}
export const enum VoicePresenceProfile {
  none = 'none',
  low = 'low',
  medium = 'medium',
  high = 'high',
}
export const enum PredominantVoiceGender {
  none = 'none',
  female = 'female',
  male = 'male',
}
/** Describes all possible genre tags. */
export const enum AudioAnalysisV6GenreTags {
  ambient = 'ambient',
  blues = 'blues',
  classical = 'classical',
  electronicDance = 'electronicDance',
  folkCountry = 'folkCountry',
  jazz = 'jazz',
  funkSoul = 'funkSoul',
  latin = 'latin',
  metal = 'metal',
  pop = 'pop',
  rapHipHop = 'rapHipHop',
  reggae = 'reggae',
  rnb = 'rnb',
  rock = 'rock',
  singerSongwriter = 'singerSongwriter',
  country = 'country',
  indieAlternative = 'indieAlternative',
  punk = 'punk',
  folk = 'folk',
}
/** Describes all possible EDM subgenre tags. */
export const enum AudioAnalysisV6SubgenreEdmTags {
  breakbeatDrumAndBass = 'breakbeatDrumAndBass',
  deepHouse = 'deepHouse',
  electro = 'electro',
  house = 'house',
  minimal = 'minimal',
  techHouse = 'techHouse',
  techno = 'techno',
  trance = 'trance',
}
/** Describes all possible mood tags. */
export const enum AudioAnalysisV6MoodTags {
  aggressive = 'aggressive',
  calm = 'calm',
  chilled = 'chilled',
  dark = 'dark',
  energetic = 'energetic',
  epic = 'epic',
  happy = 'happy',
  romantic = 'romantic',
  sad = 'sad',
  scary = 'scary',
  sexy = 'sexy',
  ethereal = 'ethereal',
  uplifting = 'uplifting',
  ambiguous = 'ambiguous',
}
export const enum AudioAnalysisV6SubgenreTags {
  bluesRock = 'bluesRock',
  folkRock = 'folkRock',
  hardRock = 'hardRock',
  indieAlternative = 'indieAlternative',
  psychedelicProgressiveRock = 'psychedelicProgressiveRock',
  punk = 'punk',
  rockAndRoll = 'rockAndRoll',
  popSoftRock = 'popSoftRock',
  abstractIDMLeftfield = 'abstractIDMLeftfield',
  breakbeatDnB = 'breakbeatDnB',
  deepHouse = 'deepHouse',
  electro = 'electro',
  house = 'house',
  minimal = 'minimal',
  synthPop = 'synthPop',
  techHouse = 'techHouse',
  techno = 'techno',
  trance = 'trance',
  contemporaryRnB = 'contemporaryRnB',
  gangsta = 'gangsta',
  jazzyHipHop = 'jazzyHipHop',
  popRap = 'popRap',
  trap = 'trap',
  blackMetal = 'blackMetal',
  deathMetal = 'deathMetal',
  doomMetal = 'doomMetal',
  heavyMetal = 'heavyMetal',
  metalcore = 'metalcore',
  nuMetal = 'nuMetal',
  disco = 'disco',
  funk = 'funk',
  gospel = 'gospel',
  neoSoul = 'neoSoul',
  soul = 'soul',
  bigBandSwing = 'bigBandSwing',
  bebop = 'bebop',
  contemporaryJazz = 'contemporaryJazz',
  easyListening = 'easyListening',
  fusion = 'fusion',
  latinJazz = 'latinJazz',
  smoothJazz = 'smoothJazz',
  country = 'country',
  folk = 'folk',
}
/** Instruments detected by the instrument recognition. */
export const enum AudioAnalysisV6InstrumentTags {
  percussion = 'percussion',
  synth = 'synth',
  piano = 'piano',
  acousticGuitar = 'acousticGuitar',
  electricGuitar = 'electricGuitar',
  strings = 'strings',
  bass = 'bass',
  bassGuitar = 'bassGuitar',
  brassWoodwinds = 'brassWoodwinds',
}
/** The intensity of an instrument's presence throughout a track. */
export const enum AudioAnalysisInstrumentPresenceLabel {
  absent = 'absent',
  throughout = 'throughout',
  frequently = 'frequently',
  partially = 'partially',
}
/** Describes possible energy levels values. */
export const enum AudioAnalysisV6EnergyLevel {
  variable = 'variable',
  medium = 'medium',
  high = 'high',
  low = 'low',
}
/** Describes possible energy dynamics values. */
export const enum AudioAnalysisV6EnergyDynamics {
  low = 'low',
  medium = 'medium',
  high = 'high',
}
/** Describes possible emotional profile values. */
export const enum AudioAnalysisV6EmotionalProfile {
  variable = 'variable',
  negative = 'negative',
  balanced = 'balanced',
  positive = 'positive',
}
/** Describes possible emotional dynamics values. */
export const enum AudioAnalysisV6EmotionalDynamics {
  low = 'low',
  medium = 'medium',
  high = 'high',
}
/** Describes possible voice presence profile values. */
export const enum AudioAnalysisV6VoicePresenceProfile {
  none = 'none',
  low = 'low',
  medium = 'medium',
  high = 'high',
}
/** Describes possible predominant voice gender values. */
export const enum AudioAnalysisV6PredominantVoiceGender {
  none = 'none',
  female = 'female',
  male = 'male',
}
export const enum AudioAnalysisV6VoiceTags {
  female = 'female',
  instrumental = 'instrumental',
  male = 'male',
}
export const enum AudioAnalysisV6MovementTags {
  bouncy = 'bouncy',
  driving = 'driving',
  flowing = 'flowing',
  groovy = 'groovy',
  nonrhythmic = 'nonrhythmic',
  pulsing = 'pulsing',
  robotic = 'robotic',
  running = 'running',
  steady = 'steady',
  stomping = 'stomping',
}
export const enum AudioAnalysisV6CharacterTags {
  bold = 'bold',
  cool = 'cool',
  epic = 'epic',
  ethereal = 'ethereal',
  heroic = 'heroic',
  luxurious = 'luxurious',
  magical = 'magical',
  mysterious = 'mysterious',
  playful = 'playful',
  powerful = 'powerful',
  retro = 'retro',
  sophisticated = 'sophisticated',
  sparkling = 'sparkling',
  sparse = 'sparse',
  unpolished = 'unpolished',
  warm = 'warm',
}
export const enum AudioAnalysisV6ClassicalEpochTags {
  middleAge = 'middleAge',
  renaissance = 'renaissance',
  baroque = 'baroque',
  classical = 'classical',
  romantic = 'romantic',
  contemporary = 'contemporary',
}
export const enum AudioAnalysisV6MoodAdvancedTags {
  anxious = 'anxious',
  barren = 'barren',
  cold = 'cold',
  creepy = 'creepy',
  dark = 'dark',
  disturbing = 'disturbing',
  eerie = 'eerie',
  evil = 'evil',
  fearful = 'fearful',
  mysterious = 'mysterious',
  nervous = 'nervous',
  restless = 'restless',
  spooky = 'spooky',
  strange = 'strange',
  supernatural = 'supernatural',
  suspenseful = 'suspenseful',
  tense = 'tense',
  weird = 'weird',
  aggressive = 'aggressive',
  agitated = 'agitated',
  angry = 'angry',
  dangerous = 'dangerous',
  fiery = 'fiery',
  intense = 'intense',
  passionate = 'passionate',
  ponderous = 'ponderous',
  violent = 'violent',
  comedic = 'comedic',
  eccentric = 'eccentric',
  funny = 'funny',
  mischievous = 'mischievous',
  quirky = 'quirky',
  whimsical = 'whimsical',
  boisterous = 'boisterous',
  boingy = 'boingy',
  bright = 'bright',
  celebratory = 'celebratory',
  cheerful = 'cheerful',
  excited = 'excited',
  feelGood = 'feelGood',
  fun = 'fun',
  happy = 'happy',
  joyous = 'joyous',
  lighthearted = 'lighthearted',
  perky = 'perky',
  playful = 'playful',
  rollicking = 'rollicking',
  upbeat = 'upbeat',
  calm = 'calm',
  contented = 'contented',
  dreamy = 'dreamy',
  introspective = 'introspective',
  laidBack = 'laidBack',
  leisurely = 'leisurely',
  lyrical = 'lyrical',
  peaceful = 'peaceful',
  quiet = 'quiet',
  relaxed = 'relaxed',
  serene = 'serene',
  soothing = 'soothing',
  spiritual = 'spiritual',
  tranquil = 'tranquil',
  bittersweet = 'bittersweet',
  blue = 'blue',
  depressing = 'depressing',
  gloomy = 'gloomy',
  heavy = 'heavy',
  lonely = 'lonely',
  melancholic = 'melancholic',
  mournful = 'mournful',
  poignant = 'poignant',
  sad = 'sad',
  frightening = 'frightening',
  horror = 'horror',
  menacing = 'menacing',
  nightmarish = 'nightmarish',
  ominous = 'ominous',
  panicStricken = 'panicStricken',
  scary = 'scary',
  concerned = 'concerned',
  determined = 'determined',
  dignified = 'dignified',
  emotional = 'emotional',
  noble = 'noble',
  serious = 'serious',
  solemn = 'solemn',
  thoughtful = 'thoughtful',
  cool = 'cool',
  seductive = 'seductive',
  sexy = 'sexy',
  adventurous = 'adventurous',
  confident = 'confident',
  courageous = 'courageous',
  resolute = 'resolute',
  energetic = 'energetic',
  epic = 'epic',
  exciting = 'exciting',
  exhilarating = 'exhilarating',
  heroic = 'heroic',
  majestic = 'majestic',
  powerful = 'powerful',
  prestigious = 'prestigious',
  relentless = 'relentless',
  strong = 'strong',
  triumphant = 'triumphant',
  victorious = 'victorious',
  delicate = 'delicate',
  graceful = 'graceful',
  hopeful = 'hopeful',
  innocent = 'innocent',
  intimate = 'intimate',
  kind = 'kind',
  light = 'light',
  loving = 'loving',
  nostalgic = 'nostalgic',
  reflective = 'reflective',
  romantic = 'romantic',
  sentimental = 'sentimental',
  soft = 'soft',
  sweet = 'sweet',
  tender = 'tender',
  warm = 'warm',
  anthemic = 'anthemic',
  aweInspiring = 'aweInspiring',
  euphoric = 'euphoric',
  inspirational = 'inspirational',
  motivational = 'motivational',
  optimistic = 'optimistic',
  positive = 'positive',
  proud = 'proud',
  soaring = 'soaring',
  uplifting = 'uplifting',
}
/** Instruments detected by the instrument recognition. */
export const enum AudioAnalysisV7InstrumentTags {
  percussion = 'percussion',
  synth = 'synth',
  piano = 'piano',
  acousticGuitar = 'acousticGuitar',
  electricGuitar = 'electricGuitar',
  strings = 'strings',
  bass = 'bass',
  bassGuitar = 'bassGuitar',
  brass = 'brass',
  woodwinds = 'woodwinds',
}
/** Instruments detected by the instrument recognition. */
export const enum AudioAnalysisV7ExtendedInstrumentTags {
  acousticGuitar = 'acousticGuitar',
  bass = 'bass',
  bassGuitar = 'bassGuitar',
  electricGuitar = 'electricGuitar',
  percussion = 'percussion',
  piano = 'piano',
  synth = 'synth',
  strings = 'strings',
  brass = 'brass',
  woodwinds = 'woodwinds',
  tuba = 'tuba',
  frenchHorn = 'frenchHorn',
  oboe = 'oboe',
  mandolin = 'mandolin',
  cello = 'cello',
  marimba = 'marimba',
  vibraphone = 'vibraphone',
  electricPiano = 'electricPiano',
  electricOrgan = 'electricOrgan',
  harp = 'harp',
  ukulele = 'ukulele',
  harpsichord = 'harpsichord',
  churchOrgan = 'churchOrgan',
  doubleBass = 'doubleBass',
  xylophone = 'xylophone',
  glockenspiel = 'glockenspiel',
  electronicDrums = 'electronicDrums',
  drumKit = 'drumKit',
  accordion = 'accordion',
  violin = 'violin',
  flute = 'flute',
  sax = 'sax',
  trumpet = 'trumpet',
  celeste = 'celeste',
  pizzicato = 'pizzicato',
  banjo = 'banjo',
  clarinet = 'clarinet',
  bells = 'bells',
  steelDrums = 'steelDrums',
  bongoConga = 'bongoConga',
  africanPercussion = 'africanPercussion',
  tabla = 'tabla',
  sitar = 'sitar',
  taiko = 'taiko',
  asianFlute = 'asianFlute',
  asianStrings = 'asianStrings',
  luteOud = 'luteOud',
}
export const enum AudioAnalysisV7GenreTags {
  afro = 'afro',
  ambient = 'ambient',
  arab = 'arab',
  asian = 'asian',
  blues = 'blues',
  childrenJingle = 'childrenJingle',
  classical = 'classical',
  electronicDance = 'electronicDance',
  folkCountry = 'folkCountry',
  funkSoul = 'funkSoul',
  indian = 'indian',
  jazz = 'jazz',
  latin = 'latin',
  metal = 'metal',
  pop = 'pop',
  rapHipHop = 'rapHipHop',
  reggae = 'reggae',
  rnb = 'rnb',
  rock = 'rock',
  singerSongwriters = 'singerSongwriters',
  sound = 'sound',
  soundtrack = 'soundtrack',
  spokenWord = 'spokenWord',
}
export const enum AudioAnalysisV7SubgenreTags {
  bluesRock = 'bluesRock',
  folkRock = 'folkRock',
  hardRock = 'hardRock',
  indieAlternative = 'indieAlternative',
  psychedelicProgressiveRock = 'psychedelicProgressiveRock',
  punk = 'punk',
  rockAndRoll = 'rockAndRoll',
  popSoftRock = 'popSoftRock',
  abstractIDMLeftfield = 'abstractIDMLeftfield',
  breakbeatDnB = 'breakbeatDnB',
  deepHouse = 'deepHouse',
  electro = 'electro',
  house = 'house',
  minimal = 'minimal',
  synthPop = 'synthPop',
  techHouse = 'techHouse',
  techno = 'techno',
  trance = 'trance',
  contemporaryRnB = 'contemporaryRnB',
  gangsta = 'gangsta',
  jazzyHipHop = 'jazzyHipHop',
  popRap = 'popRap',
  trap = 'trap',
  blackMetal = 'blackMetal',
  deathMetal = 'deathMetal',
  doomMetal = 'doomMetal',
  heavyMetal = 'heavyMetal',
  metalcore = 'metalcore',
  nuMetal = 'nuMetal',
  disco = 'disco',
  funk = 'funk',
  gospel = 'gospel',
  neoSoul = 'neoSoul',
  soul = 'soul',
  bigBandSwing = 'bigBandSwing',
  bebop = 'bebop',
  contemporaryJazz = 'contemporaryJazz',
  easyListening = 'easyListening',
  fusion = 'fusion',
  latinJazz = 'latinJazz',
  smoothJazz = 'smoothJazz',
  country = 'country',
  folk = 'folk',
}
/** An error code returned when there is a problem with retrieving similar tracks. */
export const enum SimilarLibraryTracksErrorCode {
  crateNotFound = 'crateNotFound',
  trackNotAnalyzed = 'trackNotAnalyzed',
  indexNotFound = 'indexNotFound',
}
/** Error codes that can be returned by the 'crateCreate' mutation. */
export const enum CrateCreateErrorCode {
  operationError = 'operationError',
  limitExceeded = 'limitExceeded',
  crateNameTooLong = 'crateNameTooLong',
  notEligible = 'notEligible',
}
/** Error codes that can be returned by the 'crateDelete' Mutation. */
export const enum CrateDeleteErrorCode {
  operationError = 'operationError',
  incorrectInput = 'incorrectInput',
  notEligible = 'notEligible',
}
/** Error codes that can be returned by the 'crateAddLibraryTracks' Mutation. */
export const enum CrateAddLibraryTracksErrorCode {
  operationError = 'operationError',
  incorrectInput = 'incorrectInput',
  noSuchCrate = 'noSuchCrate',
  limitExceeded = 'limitExceeded',
  notEligible = 'notEligible',
}
/** Error codes that can be returned by the 'crateRemoveLibraryTracks' Mutation. */
export const enum CrateRemoveLibraryTracksErrorCode {
  operationError = 'operationError',
  incorrectInput = 'incorrectInput',
  noSuchCrate = 'noSuchCrate',
  notEligible = 'notEligible',
}
export const enum LibraryTrackCreateErrorCode {
  fileUploadNotFound = 'fileUploadNotFound',
  invalidUploadId = 'invalidUploadId',
  librarySizeLimitExceededError = 'librarySizeLimitExceededError',
}
export const enum LibraryTrackEnqueueErrorCode {
  limitExceeded = 'limitExceeded',
  libraryTrackNotFound = 'libraryTrackNotFound',
}
export const enum LibraryTracksDeleteErrorCode {
  tooManyTracks = 'tooManyTracks',
}
export const enum YouTubeTrackEnqueueErrorCode {
  invalidYouTubeLink = 'invalidYouTubeLink',
  videoDurationExceeded = 'videoDurationExceeded',
  librarySizeLimitExceeded = 'librarySizeLimitExceeded',
  analysisLimitExceeded = 'analysisLimitExceeded',
}
/** Possible error codes of 'Track.similarTracks'. */
export const enum SimilarTracksErrorCode {
  crateNotFound = 'crateNotFound',
  trackNotAnalyzed = 'trackNotAnalyzed',
  indexNotFound = 'indexNotFound',
  notEligible = 'notEligible',
}
/** Musical keys */
export const enum MusicalKey {
  aMinor = 'aMinor',
  eMinor = 'eMinor',
  bMinor = 'bMinor',
  fsMinor = 'fsMinor',
  csMinor = 'csMinor',
  gsMinor = 'gsMinor',
  dsMinor = 'dsMinor',
  bbMinor = 'bbMinor',
  fMinor = 'fMinor',
  cMinor = 'cMinor',
  gMinor = 'gMinor',
  dMinor = 'dMinor',
  cMajor = 'cMajor',
  gMajor = 'gMajor',
  dMajor = 'dMajor',
  aMajor = 'aMajor',
  eMajor = 'eMajor',
  bMajor = 'bMajor',
  fsMajor = 'fsMajor',
  dbMajor = 'dbMajor',
  abMajor = 'abMajor',
  ebMajor = 'ebMajor',
  bbMajor = 'bbMajor',
  fMajor = 'fMajor',
}
/** List of musical genres. */
export const enum MusicalGenre {
  ambient = 'ambient',
  blues = 'blues',
  classical = 'classical',
  country = 'country',
  electronicDance = 'electronicDance',
  folk = 'folk',
  indieAlternative = 'indieAlternative',
  jazz = 'jazz',
  latin = 'latin',
  metal = 'metal',
  pop = 'pop',
  punk = 'punk',
  rapHipHop = 'rapHipHop',
  reggae = 'reggae',
  rnb = 'rnb',
  rock = 'rock',
  singerSongwriters = 'singerSongwriters',
}
/** An error code returned when there is a problem with retrieving similar tracks. */
export const enum KeywordSearchErrorCode {
  crateNotFound = 'crateNotFound',
  indexNotFound = 'indexNotFound',
  invalidKeywords = 'invalidKeywords',
  tooManyKeywords = 'tooManyKeywords',
  notEligible = 'notEligible',
}
export const enum AugmentedKeywordsErrorCode {
  notEligible = 'notEligible',
  unavailable = 'unavailable',
}
export const enum BrandValuesErrorCode {
  notEligible = 'notEligible',
  unavailable = 'unavailable',
  notSelected = 'notSelected',
  outsideOfScope = 'outsideOfScope',
  tooMany = 'tooMany',
}
export const enum FreeTextSearchErrorCode {
  crateNotFound = 'crateNotFound',
  trackNotAnalyzed = 'trackNotAnalyzed',
  indexNotFound = 'indexNotFound',
  notEligible = 'notEligible',
}
export const enum LyricsSearchErrorCode {
  notEligible = 'notEligible',
}

type ZEUS_VARIABLES = {
  ['AnalysisStatus']: ValueTypes['AnalysisStatus'];
  ['SimilaritySearchWeightFilter']: ValueTypes['SimilaritySearchWeightFilter'];
  ['EnergyLevel']: ValueTypes['EnergyLevel'];
  ['EnergyDynamics']: ValueTypes['EnergyDynamics'];
  ['EmotionalProfile']: ValueTypes['EmotionalProfile'];
  ['EmotionalDynamics']: ValueTypes['EmotionalDynamics'];
  ['VoicePresenceProfile']: ValueTypes['VoicePresenceProfile'];
  ['PredominantVoiceGender']: ValueTypes['PredominantVoiceGender'];
  ['InDepthAnalysisCreateInput']: ValueTypes['InDepthAnalysisCreateInput'];
  ['AudioAnalysisV6GenreTags']: ValueTypes['AudioAnalysisV6GenreTags'];
  ['AudioAnalysisV6SubgenreEdmTags']: ValueTypes['AudioAnalysisV6SubgenreEdmTags'];
  ['AudioAnalysisV6MoodTags']: ValueTypes['AudioAnalysisV6MoodTags'];
  ['AudioAnalysisV6SubgenreTags']: ValueTypes['AudioAnalysisV6SubgenreTags'];
  ['AudioAnalysisV6InstrumentTags']: ValueTypes['AudioAnalysisV6InstrumentTags'];
  ['AudioAnalysisInstrumentPresenceLabel']: ValueTypes['AudioAnalysisInstrumentPresenceLabel'];
  ['AudioAnalysisV6EnergyLevel']: ValueTypes['AudioAnalysisV6EnergyLevel'];
  ['AudioAnalysisV6EnergyDynamics']: ValueTypes['AudioAnalysisV6EnergyDynamics'];
  ['AudioAnalysisV6EmotionalProfile']: ValueTypes['AudioAnalysisV6EmotionalProfile'];
  ['AudioAnalysisV6EmotionalDynamics']: ValueTypes['AudioAnalysisV6EmotionalDynamics'];
  ['AudioAnalysisV6VoicePresenceProfile']: ValueTypes['AudioAnalysisV6VoicePresenceProfile'];
  ['AudioAnalysisV6PredominantVoiceGender']: ValueTypes['AudioAnalysisV6PredominantVoiceGender'];
  ['AudioAnalysisV6VoiceTags']: ValueTypes['AudioAnalysisV6VoiceTags'];
  ['AudioAnalysisV6MovementTags']: ValueTypes['AudioAnalysisV6MovementTags'];
  ['AudioAnalysisV6CharacterTags']: ValueTypes['AudioAnalysisV6CharacterTags'];
  ['AudioAnalysisV6ClassicalEpochTags']: ValueTypes['AudioAnalysisV6ClassicalEpochTags'];
  ['AudioAnalysisV6MoodAdvancedTags']: ValueTypes['AudioAnalysisV6MoodAdvancedTags'];
  ['AudioAnalysisV7InstrumentTags']: ValueTypes['AudioAnalysisV7InstrumentTags'];
  ['AudioAnalysisV7ExtendedInstrumentTags']: ValueTypes['AudioAnalysisV7ExtendedInstrumentTags'];
  ['AudioAnalysisV7GenreTags']: ValueTypes['AudioAnalysisV7GenreTags'];
  ['AudioAnalysisV7SubgenreTags']: ValueTypes['AudioAnalysisV7SubgenreTags'];
  ['SimilarLibraryTracksErrorCode']: ValueTypes['SimilarLibraryTracksErrorCode'];
  ['LibraryTracksFilter']: ValueTypes['LibraryTracksFilter'];
  ['CrateCreateErrorCode']: ValueTypes['CrateCreateErrorCode'];
  ['CrateDeleteInput']: ValueTypes['CrateDeleteInput'];
  ['CrateCreateInput']: ValueTypes['CrateCreateInput'];
  ['CrateAddLibraryTracksInput']: ValueTypes['CrateAddLibraryTracksInput'];
  ['CrateRemoveLibraryTracksInput']: ValueTypes['CrateRemoveLibraryTracksInput'];
  ['CrateDeleteErrorCode']: ValueTypes['CrateDeleteErrorCode'];
  ['CrateAddLibraryTracksErrorCode']: ValueTypes['CrateAddLibraryTracksErrorCode'];
  ['CrateRemoveLibraryTracksErrorCode']: ValueTypes['CrateRemoveLibraryTracksErrorCode'];
  ['LibraryTrackCreateInput']: ValueTypes['LibraryTrackCreateInput'];
  ['LibraryTrackCreateErrorCode']: ValueTypes['LibraryTrackCreateErrorCode'];
  ['LibraryTrackEnqueueErrorCode']: ValueTypes['LibraryTrackEnqueueErrorCode'];
  ['LibraryTrackEnqueueInput']: ValueTypes['LibraryTrackEnqueueInput'];
  ['LibraryTracksDeleteErrorCode']: ValueTypes['LibraryTracksDeleteErrorCode'];
  ['LibraryTracksDeleteInput']: ValueTypes['LibraryTracksDeleteInput'];
  ['YouTubeTrackEnqueueErrorCode']: ValueTypes['YouTubeTrackEnqueueErrorCode'];
  ['YouTubeTrackEnqueueInput']: ValueTypes['YouTubeTrackEnqueueInput'];
  ['SpotifyTrackEnqueueInput']: ValueTypes['SpotifyTrackEnqueueInput'];
  ['SimilarTracksErrorCode']: ValueTypes['SimilarTracksErrorCode'];
  ['MusicalKey']: ValueTypes['MusicalKey'];
  ['MusicalGenre']: ValueTypes['MusicalGenre'];
  ['SimilarTracksSearchModeInterval']: ValueTypes['SimilarTracksSearchModeInterval'];
  ['SimilarTracksSearchMode']: ValueTypes['SimilarTracksSearchMode'];
  ['SimilarTracksTargetLibrary']: ValueTypes['SimilarTracksTargetLibrary'];
  ['SimilarTracksTargetSpotify']: ValueTypes['SimilarTracksTargetSpotify'];
  ['SimilarTracksTargetCrate']: ValueTypes['SimilarTracksTargetCrate'];
  ['SimilarTracksTarget']: ValueTypes['SimilarTracksTarget'];
  ['experimental_SimilarTracksFilterBpmInput']: ValueTypes['experimental_SimilarTracksFilterBpmInput'];
  ['experimental_SimilarTracksFilterBpmRange']: ValueTypes['experimental_SimilarTracksFilterBpmRange'];
  ['experimental_SimilarTracksFilterBpm']: ValueTypes['experimental_SimilarTracksFilterBpm'];
  ['experimental_SimilarTracksFilterGenreInput']: ValueTypes['experimental_SimilarTracksFilterGenreInput'];
  ['experimental_SimilarTracksFilterGenre']: ValueTypes['experimental_SimilarTracksFilterGenre'];
  ['experimental_SimilarTracksFilterKeyCamelotInput']: ValueTypes['experimental_SimilarTracksFilterKeyCamelotInput'];
  ['experimental_SimilarTracksFilterKeyCamelot']: ValueTypes['experimental_SimilarTracksFilterKeyCamelot'];
  ['experimental_SimilarTracksFilterKeyMatchingInput']: ValueTypes['experimental_SimilarTracksFilterKeyMatchingInput'];
  ['experimental_SimilarTracksFilterKeyMatching']: ValueTypes['experimental_SimilarTracksFilterKeyMatching'];
  ['experimental_SimilarTracksFilterKey']: ValueTypes['experimental_SimilarTracksFilterKey'];
  ['experimental_SimilarTracksFilter']: ValueTypes['experimental_SimilarTracksFilter'];
  ['KeywordSearchKeyword']: ValueTypes['KeywordSearchKeyword'];
  ['KeywordSearchErrorCode']: ValueTypes['KeywordSearchErrorCode'];
  ['KeywordSearchTargetLibrary']: ValueTypes['KeywordSearchTargetLibrary'];
  ['KeywordSearchTargetCrate']: ValueTypes['KeywordSearchTargetCrate'];
  ['KeywordSearchTargetSpotify']: ValueTypes['KeywordSearchTargetSpotify'];
  ['KeywordSearchTarget']: ValueTypes['KeywordSearchTarget'];
  ['AugmentedKeywordsErrorCode']: ValueTypes['AugmentedKeywordsErrorCode'];
  ['SelectBrandValuesInput']: ValueTypes['SelectBrandValuesInput'];
  ['BrandValuesErrorCode']: ValueTypes['BrandValuesErrorCode'];
  ['FreeTextSearchErrorCode']: ValueTypes['FreeTextSearchErrorCode'];
  ['FreeTextSearchTargetLibrary']: ValueTypes['FreeTextSearchTargetLibrary'];
  ['FreeTextSearchTargetCrate']: ValueTypes['FreeTextSearchTargetCrate'];
  ['FreeTextSearchTargetSpotify']: ValueTypes['FreeTextSearchTargetSpotify'];
  ['FreeTextSearchTarget']: ValueTypes['FreeTextSearchTarget'];
  ['LyricsSearchErrorCode']: ValueTypes['LyricsSearchErrorCode'];
  ['LyricsSearchTargetSpotify']: ValueTypes['LyricsSearchTargetSpotify'];
  ['LyricsSearchTarget']: ValueTypes['LyricsSearchTarget'];
};
