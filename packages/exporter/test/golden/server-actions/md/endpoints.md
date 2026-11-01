# Endpoints

[← Overview](README.md)

6 endpoints on 2 hosts, 2 called from the browser. One endpoint is a method and URL pattern; tRPC procedures, GraphQL operations and server actions count one each. Requests to this app's own route handlers are listed under "This app's API", and what those handlers send on under the host it goes to.

## <a id="host-app"></a>This app's API

| Endpoint | Transport | Called from | Call sites | Pages | Status |
| --- | --- | --- | ---: | ---: | --- |
| [`action createProduct`](#ep_09hajlev2r5) | server action | browser | 1 | 1 | ✓ verified |
| [`action deleteProduct`](#ep_0ukrbhfpyjv) | server action | browser | 1 | 1 | ✓ verified |

### <a id="ep_09hajlev2r5"></a>`action createProduct`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | server action |
| Called from | browser |
| Pages | [`/products/new`](pages/products.new.md) |
| Call sites | [`POST createProduct (server action)`](components/CreateProductForm.md#req_07o63rveyo8) in [`CreateProductForm`](components/CreateProductForm.md) |

**Request body** `FormData`

**Response** [`FormState`](types.md#typ_1a49e9mbomv)

```ts
{
  error?: string
  fieldErrors?: { name?: string; price?: string; stock?: string }
}
```

**Captured** `POST http://localhost:3077/products/new` → 200 OK · 1511 ms · 2026-10-28 10:56 UTC · page `/products/new`

Request body:

```json
{
  "0": "[{},\"$K1\"]",
  "_1_$ACTION_REF_1": "",
  "_1_$ACTION_1:0": "{\"id\":\"606e847d81ec6abfee1463e13cbec85d240ffaad9e\",\"bound\":\"$@1\"}",
  "_1_$ACTION_1:1": "[{}]",
  "_1_$ACTION_KEY": "kc796061555ae5a957e9949ace41126c9",
  "_1_name": "Cable",
  "_1_price": "9.5",
  "_1_stock": "0"
}
```

Response body:

```text
2:"[project]/node_modules/.pnpm/next@16.4.3_@playwright+tes_e8eec4a489bcf8c57698457e34201021/node_modules/next/dist/next-devtools/userspace/app/segment-explorer-node.js [app-client] (ecmascript)"
3:"/_next/static/chunks/1ghd_next_dist_1kw6l690y4jc_._.js"
4:I["$2",["$3"],"SegmentViewNode"]
6:"$Sreact.fragment"
17:"[project]/node_modules/.pnpm/next@16.4.3_@playwright+tes_e8eec4a489bcf8c57698457e34201021/node_modules/next/dist/client/components/layout-router.js [app-client] (ecmascript)"
18:I["$17",["$3"],"default"]
1a:"[project]/node_modules/.pnpm/next@16.4.3_@playwright+tes_e8eec4a489bcf8c57698457e34201021/node_modules/next/dist/client/components/render-from-template-context.js [app-client] (ecmascript)"
1b:I["$1a",["$3"],"default"]
44:"[project]/node_modules/.pnpm/next@16.4.3_@playwright+tes_e8eec4a489bcf8c57698457e34201021/node_modules/next/dist/lib/framework/boundary-components.js [app-client] (ecmascript)"
45:I["$44",["$3"],"OutletBoundary"]
47:"$Sreact.suspense"
54:"ViewportBoundary"
55:I["$44",["$3"],"$54"]
5e:"MetadataBoundary"
5f:I["$44",["$3"],"$5e"]
8:D"$12"
8:D"$9"
8:D"$14"
1d:D"$1f"
1d:D"$1e"
1d:D"$21"
1d:D"$20"
1d:D"$22"
1d:[["$","title",null,{"children":"404: This page could not be found."},"$20","$23",1],["$","div",null,{"style":{"fontFamily":"system-ui,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif,\"Apple Color Emoji\",\"Segoe UI Emoji\"","height":"100vh","textAlign":"center","display":"flex","flexDirection":"column","alignItems":"center","justifyContent":"center"},"children":["$","div",null,{"children":[["$","style",null,{"dangerouslySetInnerHTML":{"__html":"body{color:#000;background:#fff;margin:0}.next-error-h1{border-right:1px solid rgba(0,0,0,.3)}@media (prefers-color-scheme:dark){body{color:#fff;background:#000}.next-error-h1{border-right:1px solid rgba(255,255,255,.3)}}"}},"$20","$26",1],["$","h1",null,{"className":"next-error-h1","style":{"display":"inline-block","margin":"0 20px 0 0","padding":"0 23px 0 0","fontSize":24,"fontWeight":500,"verticalAlign":"top","lineHeight":"49px"},"children":404},"$20","$27",1],["$","div",null,{"style":{"display":"inline-block"},"children":["$","h2",null,{"style":{"fontSize":14,"fontWeight":400,"lineHeight":"49px","margin":0},"children":"This page could not be found."},"$20","$29",1]},"$20","$28",1]]},"$20","$25",1]},"$20","$24",1]]
8:["$","html",null,{"lang":"en","children":["$","body",null,{"children":["$","$L18",null,{"parallelRouterKey":"children","error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L1b",null,{},null,"$19",1],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":["$","$L4","c-not-found",{"type":"not-found","pagePath":"__next_builtin__not-found.js","children":["$1d",[]]},null,"$1c",0],"forbidden":"$undefined","unauthorized":"$undefined","segmentViewBoundaries":[["$","$L4",null,{"type":"boundary:not-found","pagePath":"__next_builtin__not-found.js@boundary"},null,"$2a",1],"$undefined","$undefined",["$","$L4",null,{"type":"boundary:global-error","pagePath":"__next_builtin__global-error.js"},null,"$2b",1]]},null,"$16",1]},"$9","$15",1]},"$9","$13",1]
30:X
38:D"$3c"
38:D"$39"
3e:D"$41"
3e:D"$3f"
3e:D"$43"
3e:["$","$L45",null,{"children":["$","$47",null,{"name":"Next.MetadataOutlet","children":"$@48"},"$3f","$46",1]},"$3f","$42",1]
35:[["children",{"s":"__PAGE__","d":{"r":["$","$6","c",{"children":[["$","$L4","c-page",{"type":"page","pagePath":"products/[id]/page.tsx","children":"$L38"},null,"$37",1],[["$","script","script-0",{"src":"/_next/static/chunks/1ghd_next_dist_01f0h1eop3rqv._.js","async":true,"nonce":"$undefined"},null,"$3d",0]],"$3e"]},null,"$36",0],"p":false,"v":null}}]]
31:[["children",{"s":{"n":"id","t":"d","k":"3","s":["new"]},"d":{"r":["$","$6","c",{"children":[null,["$","$L18",null,{"parallelRouterKey":"children","error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L1b",null,{},null,"$34",1],"templateStyles":"$undefined","templateScripts":"$un
… (42 more lines)
```

### <a id="ep_0ukrbhfpyjv"></a>`action deleteProduct`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | server action |
| Called from | browser |
| Pages | [`/products`](pages/products.md) |
| Call sites | [`POST deleteProduct (server action)`](components/DeleteProductButton.md#req_0b08g87h2vb) in [`DeleteProductButton`](components/DeleteProductButton.md) |

**Request body** `number`

**Response** `void`

**Captured** `POST http://localhost:3077/products` → 200 OK · 82 ms · 2026-10-28 10:57 UTC · page `/products`

Request body:

```json
[
  1
]
```

Response body:

```text
3:"[project]/node_modules/.pnpm/next@16.4.3_@playwright+tes_e8eec4a489bcf8c57698457e34201021/node_modules/next/dist/next-devtools/userspace/app/segment-explorer-node.js [app-client] (ecmascript)"
4:"/_next/static/chunks/1ghd_next_dist_1kw6l690y4jc_._.js"
5:I["$3",["$4"],"SegmentViewNode"]
7:"$Sreact.fragment"
18:"[project]/node_modules/.pnpm/next@16.4.3_@playwright+tes_e8eec4a489bcf8c57698457e34201021/node_modules/next/dist/client/components/layout-router.js [app-client] (ecmascript)"
19:I["$18",["$4"],"default"]
1b:"[project]/node_modules/.pnpm/next@16.4.3_@playwright+tes_e8eec4a489bcf8c57698457e34201021/node_modules/next/dist/client/components/render-from-template-context.js [app-client] (ecmascript)"
1c:I["$1b",["$4"],"default"]
41:"[project]/node_modules/.pnpm/next@16.4.3_@playwright+tes_e8eec4a489bcf8c57698457e34201021/node_modules/next/dist/lib/framework/boundary-components.js [app-client] (ecmascript)"
42:I["$41",["$4"],"OutletBoundary"]
44:"$Sreact.suspense"
51:"ViewportBoundary"
52:I["$41",["$4"],"$51"]
5b:"MetadataBoundary"
5c:I["$41",["$4"],"$5b"]
9:D"$13"
9:D"$a"
9:D"$15"
1e:D"$20"
1e:D"$1f"
1e:D"$22"
1e:D"$21"
1e:D"$23"
1e:[["$","title",null,{"children":"404: This page could not be found."},"$21","$24",1],["$","div",null,{"style":{"fontFamily":"system-ui,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif,\"Apple Color Emoji\",\"Segoe UI Emoji\"","height":"100vh","textAlign":"center","display":"flex","flexDirection":"column","alignItems":"center","justifyContent":"center"},"children":["$","div",null,{"children":[["$","style",null,{"dangerouslySetInnerHTML":{"__html":"body{color:#000;background:#fff;margin:0}.next-error-h1{border-right:1px solid rgba(0,0,0,.3)}@media (prefers-color-scheme:dark){body{color:#fff;background:#000}.next-error-h1{border-right:1px solid rgba(255,255,255,.3)}}"}},"$21","$27",1],["$","h1",null,{"className":"next-error-h1","style":{"display":"inline-block","margin":"0 20px 0 0","padding":"0 23px 0 0","fontSize":24,"fontWeight":500,"verticalAlign":"top","lineHeight":"49px"},"children":404},"$21","$28",1],["$","div",null,{"style":{"display":"inline-block"},"children":["$","h2",null,{"style":{"fontSize":14,"fontWeight":400,"lineHeight":"49px","margin":0},"children":"This page could not be found."},"$21","$2a",1]},"$21","$29",1]]},"$21","$26",1]},"$21","$25",1]]
9:["$","html",null,{"lang":"en","children":["$","body",null,{"children":["$","$L19",null,{"parallelRouterKey":"children","error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L1c",null,{},null,"$1a",1],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":["$","$L5","c-not-found",{"type":"not-found","pagePath":"__next_builtin__not-found.js","children":["$1e",[]]},null,"$1d",0],"forbidden":"$undefined","unauthorized":"$undefined","segmentViewBoundaries":[["$","$L5",null,{"type":"boundary:not-found","pagePath":"__next_builtin__not-found.js@boundary"},null,"$2b",1],"$undefined","$undefined",["$","$L5",null,{"type":"boundary:global-error","pagePath":"__next_builtin__global-error.js"},null,"$2c",1]]},null,"$17",1]},"$a","$16",1]},"$a","$14",1]
31:X
35:D"$39"
35:D"$36"
3b:D"$3e"
3b:D"$3c"
3b:D"$40"
3b:["$","$L42",null,{"children":["$","$44",null,{"name":"Next.MetadataOutlet","children":"$@45"},"$3c","$43",1]},"$3c","$3f",1]
32:[["children",{"s":"__PAGE__","d":{"r":["$","$7","c",{"children":[["$","$L5","c-page",{"type":"page","pagePath":"products/page.tsx","children":"$L35"},null,"$34",1],[["$","script","script-0",{"src":"/_next/static/chunks/_1h7rz_9hpo7cd._.js","async":true,"nonce":"$undefined"},null,"$3a",0]],"$3b"]},null,"$33",0],"p":false,"v":null}}]]
2d:[["children",{"s":"products","d":{"r":["$","$7","c",{"children":[null,["$","$L19",null,{"parallelRouterKey":"children","error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L1c",null,{},null,"$30",1],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":"$undefined","forbidden":"$
… (54 more lines)
```

## <a id="host-env_API_URL"></a>`{API_URL ?? http://localhost:4010}`

Base URL from `process.env.API_URL`, falls back to `http://localhost:4010`.

| Endpoint | Transport | Called from | Call sites | Pages | Status |
| --- | --- | --- | ---: | ---: | --- |
| [`GET /products`](#ep_16a5uohh2s8) | HTTP | server | 1 | 1 | ✓ verified |
| [`POST /products`](#ep_1b8rxbacsrz) | HTTP | server | 1 | 1 | ✓ verified |
| [`GET /products/:id`](#ep_16zjeuqipey) | HTTP | server | 1 | 1 | ✓ verified |
| [`DELETE /products/:id`](#ep_24zdsb1p2vt) | HTTP | server | 1 | 1 | ✓ verified |

### <a id="ep_16a5uohh2s8"></a>`GET /products`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | server |
| Pages | [`/products`](pages/products.md) |
| Call sites | [`GET {API_URL ?? http://localhost:4010}/products`](components/ProductsPage.md#req_1u9qpywsqwd) in [`ProductsPage`](components/ProductsPage.md) |

**Response** `Product[]` (see [`Product`](types.md#typ_0c608pp860k))

**Captured** `GET http://localhost:4010/products` → 200 OK · 26 ms · 2026-10-28 10:57 UTC (newest of 4)

Response body:

```json
[
  {
    "id": 2,
    "name": "Mouse",
    "price": 19.5,
    "stock": 0
  },
  {
    "id": 3,
    "stock": 0,
    "name": "Cable",
    "price": 9.5
  }
]
```

### <a id="ep_1b8rxbacsrz"></a>`POST /products`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | server |
| Pages | [`/products/new`](pages/products.new.md) |
| Call sites | [`POST {API_URL ?? http://localhost:4010}/products`](components/CreateProductForm.md#req_0h59cmicyii) in server action `createProduct` |

**Request body** [`CreateProductInput`](types.md#typ_1ft4f009hfw)

```ts
{ name: string; price: number; stock: number }
```

**Response** [`Product`](types.md#typ_0c608pp860k)

```ts
{ id: number; name: string; price: number; stock: number }
```

**Captured** `POST http://localhost:4010/products` → 201 Created · 8 ms · 2026-10-28 10:56 UTC

Request body:

```json
{
  "name": "Cable",
  "price": 9.5,
  "stock": 0
}
```

Response body:

```json
{
  "id": 3,
  "stock": 0,
  "name": "Cable",
  "price": 9.5
}
```

### <a id="ep_16zjeuqipey"></a>`GET /products/:id`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | server |
| Pages | [`/products/[id]`](pages/products.%5Bid%5D.md) |
| Call sites | [`GET {API_URL ?? http://localhost:4010}/products/:id`](components/ProductPage.md#req_25a1hdpohd6) in [`ProductPage`](components/ProductPage.md) |

**Response** `Product | null` (see [`Product`](types.md#typ_0c608pp860k))

**Captured** `GET http://localhost:4010/products/3` → 200 OK · 18 ms · 2026-10-28 10:56 UTC

Response body:

```json
{
  "id": 3,
  "stock": 0,
  "name": "Cable",
  "price": 9.5
}
```

### <a id="ep_24zdsb1p2vt"></a>`DELETE /products/:id`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | server |
| Pages | [`/products`](pages/products.md) |
| Call sites | [`DELETE {API_URL ?? http://localhost:4010}/products/:id`](components/DeleteProductButton.md#req_11sozx68f2s) in server action `deleteProduct` |

**Response** `void`

**Captured** `DELETE http://localhost:4010/products/1` → 204 No Content · 3 ms · 2026-10-28 10:57 UTC
