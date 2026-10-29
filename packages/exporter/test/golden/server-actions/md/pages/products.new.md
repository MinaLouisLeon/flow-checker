# Page `/products/new`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/products/new/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`src/app/layout.tsx`) |
| Status | ✓ 1 verified |

## Component tree

- [`NewProductPage`](../components/NewProductPage.md) · server
  - [`CreateProductForm`](../components/CreateProductForm.md) · client · ⇄ 1 request

## Navigation

- To [`/products/[id]`](products.%5Bid%5D.md) (redirect)
- From [`/products`](products.md) (link)

## Flows

- [CreateProductForm submit](../flows/createproductform-submit.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`POST createProduct (server action)`](#req_07o63rveyo8) | event action | [`CreateProductForm`](../components/CreateProductForm.md) | ✓ verified (1 capture) |

### <a id="req_07o63rveyo8"></a>`POST createProduct (server action)`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`CreateProductForm`](../components/CreateProductForm.md) · `src/components/CreateProductForm.tsx:11` |
| Trigger | event action |
| Transport | server-action |

**Request body** `FormData`

**Response** [`FormState`](../types.md#typ_1a49e9mbomv)

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

**Leads to** `POST {API_URL ?? http://localhost:4010}/products`:

#### <a id="req_0h59cmicyii"></a>`POST {API_URL ?? http://localhost:4010}/products`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | server action `createProduct` · `src/actions/products.ts:21` |
| Trigger | server-action |
| Transport | fetch |
| URL | `{API_URL ?? http://localhost:4010}/products` |
| Call path | `insertProduct` → `fetch` |

**Request body** [`CreateProductInput`](../types.md#typ_1ft4f009hfw)

```ts
{ name: string; price: number; stock: number }
```

**Response** [`Product`](../types.md#typ_0c608pp860k)

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
