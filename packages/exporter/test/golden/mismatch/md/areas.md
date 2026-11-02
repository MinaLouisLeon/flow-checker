# Areas

[← Overview](README.md)

1 area. Pages are grouped by the first static part of their URL (after route groups, dynamic segments and locales). Rename or merge them with the `areas` option in `flow-checker.config.ts`.

| Area | From | Pages | Components | Flows | Endpoints | Shared components | To check |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| [home](#ar_1vn39fso9m3) | `/` | 1 | 4 | 1 | 4 | 0 | 3 |

## <a id="ar_1vn39fso9m3"></a>home

|  |  |
| --- | --- |
| From | `/` |
| Pages | [`/`](pages/index.md) |
| Components | [`RootLayout`](components/RootLayout.md), [`HomePage`](components/HomePage.md), [`SettingsPanel`](components/SettingsPanel.md), [`TodoPanel`](components/TodoPanel.md) |
| Flows | [TodoPanel submit](flows/todopanel-submit.md) |
| Endpoints | [`GET /users`](endpoints.md#ep_16nzt1zcm62), [`GET /settings`](endpoints.md#ep_014n09i1jig), [`GET /todos`](endpoints.md#ep_0i0im2g2p7v), [`POST /todos`](endpoints.md#ep_1tgnolqki2r) |
| To check | [3 open notes](issues.md) |
