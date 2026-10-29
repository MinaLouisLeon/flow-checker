# Page `/products`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/products/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`src/app/layout.tsx`) |
| Status | ✓ 2 verified |

## Component tree

- [`ProductsPage`](../components/ProductsPage.md) · server · ⇄ 1 request
  - `Link` · external (`next/link`)
  - [`DeleteProductButton`](../components/DeleteProductButton.md) · client · ⇄ 1 request

## Navigation

- From [`/`](index.md) (redirect)
- From [`/products/[id]`](products.%5Bid%5D.md) (link)
- To [`/products/new`](products.new.md) (link)
- To [`/products/[id]`](products.%5Bid%5D.md) (link)

## Flows

- [DeleteProductButton click](../flows/deleteproductbutton-click.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {API_URL ?? http://localhost:4010}/products`](#req_1u9qpywsqwd) | server-render | [`ProductsPage`](../components/ProductsPage.md) | ✓ verified (4 captures) |
| [`POST deleteProduct (server action)`](#req_0b08g87h2vb) | event onClick | [`DeleteProductButton`](../components/DeleteProductButton.md) | ✓ verified (1 capture) |

### <a id="req_1u9qpywsqwd"></a>`GET {API_URL ?? http://localhost:4010}/products`

|  |  |
| --- | --- |
| Status | ✓ verified (4 captures) |
| From | [`ProductsPage`](../components/ProductsPage.md) · `src/app/products/page.tsx:8` |
| Trigger | server-render |
| Transport | fetch |
| URL | `{API_URL ?? http://localhost:4010}/products` |
| Call path | `listProducts` → `fetch` |

**Response** `Product[]` (see [`Product`](../types.md#typ_0c608pp860k))

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

### <a id="req_0b08g87h2vb"></a>`POST deleteProduct (server action)`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`DeleteProductButton`](../components/DeleteProductButton.md) · `src/components/DeleteProductButton.tsx:11` |
| Trigger | event onClick |
| Transport | server-action |

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

**Leads to** `DELETE {API_URL ?? http://localhost:4010}/products/:id`:

#### <a id="req_11sozx68f2s"></a>`DELETE {API_URL ?? http://localhost:4010}/products/:id`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | server action `deleteProduct` · `src/actions/products.ts:31` |
| Trigger | server-action |
| Transport | fetch |
| URL | `{API_URL ?? http://localhost:4010}/products/:id` (pattern) |
| Call path | `removeProduct` → `fetch` |

**Response** `void`

**Captured** `DELETE http://localhost:4010/products/1` → 204 No Content · 3 ms · 2026-10-28 10:57 UTC
