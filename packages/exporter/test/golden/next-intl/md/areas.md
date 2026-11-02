# Areas

[← Overview](README.md)

4 areas. Pages are grouped by the first static part of their URL (after route groups, dynamic segments and locales). Rename or merge them with the `areas` option in `flow-checker.config.ts`.

| Area | From | Pages | Components | Flows | Endpoints | Shared components | To check |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| [home](#ar_1vn39fso9m3) | `/` | 1 | 1 | 0 | 0 | 1 | 0 |
| [dashboard](#ar_1q9mt49i536) | `/[locale]/dashboard` | 1 | 2 | 0 | 1 | 1 | 0 |
| [login](#ar_0pgtfiopjqa) | `/[locale]/login` | 1 | 2 | 1 | 1 | 1 | 0 |
| [verify](#ar_1fio74g3hsz) | `/[locale]/verify` | 1 | 2 | 0 | 1 | 1 | 0 |

## <a id="ar_1vn39fso9m3"></a>home

|  |  |
| --- | --- |
| From | `/` |
| Pages | [`/[locale]`](pages/%5Blocale%5D.md) |
| Components | [`HomePage`](components/HomePage.md) |
| Shared components | [`LocaleLayout`](components/LocaleLayout.md) |

## <a id="ar_1q9mt49i536"></a>dashboard

|  |  |
| --- | --- |
| From | `/[locale]/dashboard` |
| Pages | [`/[locale]/dashboard`](pages/%5Blocale%5D.dashboard.md) |
| Components | [`DashboardPage`](components/DashboardPage.md), [`DashboardProfile`](components/DashboardProfile.md) |
| Shared components | [`LocaleLayout`](components/LocaleLayout.md) |
| Endpoints | [`GET /me`](endpoints.md#ep_1rz8dmsxgvx) |

## <a id="ar_0pgtfiopjqa"></a>login

|  |  |
| --- | --- |
| From | `/[locale]/login` |
| Pages | [`/[locale]/login`](pages/%5Blocale%5D.login.md) |
| Components | [`LoginPage`](components/LoginPage.md), [`LoginForm`](components/LoginForm.md) |
| Shared components | [`LocaleLayout`](components/LocaleLayout.md) |
| Flows | [LoginForm submit](flows/loginform-submit.md) |
| Endpoints | [`POST /auth/login`](endpoints.md#ep_0plop0v393x) |

## <a id="ar_1fio74g3hsz"></a>verify

|  |  |
| --- | --- |
| From | `/[locale]/verify` |
| Pages | [`/[locale]/verify`](pages/%5Blocale%5D.verify.md) |
| Components | [`VerifyPage`](components/VerifyPage.md), [`VerifyOtpForm`](components/VerifyOtpForm.md) |
| Shared components | [`LocaleLayout`](components/LocaleLayout.md) |
| Endpoints | [`POST /auth/verify-otp`](endpoints.md#ep_07z00ubkge9) |

## Shared

Components used by more than half of the areas, and the requests only they send.

|  |  |
| --- | --- |
| Components | [`LocaleLayout`](components/LocaleLayout.md) |
