/**
 * @generated SignedSource<<59cd762179742ffa12b6e1bfdc7b52d8>>
 * @relayHash b42541fc75eb7cd603595c56864bc7a9
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

// @relayRequestID feffca234775cf9b6036b7f757110fbf6f4094f87f75b06bfefb31e31110034d

import { ConcreteRequest } from 'relay-runtime';
export type TodoStatus = "DONE" | "OPEN" | "%future added value";
export type TodoDetailQuery$variables = {
  id: string;
};
export type TodoDetailQuery$data = {
  readonly todo: {
    readonly done: boolean;
    readonly id: string;
    readonly owner: {
      readonly name: string;
    };
    readonly status: TodoStatus;
    readonly title: string;
  } | null | undefined;
};
export type TodoDetailQuery = {
  response: TodoDetailQuery$data;
  variables: TodoDetailQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "title",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "done",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "status",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "TodoDetailQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "Todo",
        "kind": "LinkedField",
        "name": "todo",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          (v3/*:: as any*/),
          (v4/*:: as any*/),
          (v5/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "User",
            "kind": "LinkedField",
            "name": "owner",
            "plural": false,
            "selections": [
              (v6/*:: as any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "TodoDetailQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "Todo",
        "kind": "LinkedField",
        "name": "todo",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          (v3/*:: as any*/),
          (v4/*:: as any*/),
          (v5/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "User",
            "kind": "LinkedField",
            "name": "owner",
            "plural": false,
            "selections": [
              (v6/*:: as any*/),
              (v2/*:: as any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "id": "feffca234775cf9b6036b7f757110fbf6f4094f87f75b06bfefb31e31110034d",
    "metadata": {},
    "name": "TodoDetailQuery",
    "operationKind": "query",
    "text": null
  }
};
})();

(node as any).hash = "cd730e6dbcbcfbf4f01224e181822e93";

export default node;
