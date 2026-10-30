/**
 * @generated SignedSource<<4276d1dc544306f3f2d649d13afed3ea>>
 * @relayHash e9a41f7bb5f9ef0326999c94eb7c88e5
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

// @relayRequestID 3f68cfe7f95fdfd770274ece724d3623c361f4a0c3a21e96fdfbf28d3d75153d

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TodoListQuery$variables = Record<PropertyKey, never>;
export type TodoListQuery$data = {
  readonly todos: ReadonlyArray<{
    readonly id: string;
    readonly " $fragmentSpreads": FragmentRefs<"TodoItem_todo">;
  }>;
};
export type TodoListQuery = {
  response: TodoListQuery$data;
  variables: TodoListQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "TodoListQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Todo",
        "kind": "LinkedField",
        "name": "todos",
        "plural": true,
        "selections": [
          (v0/*:: as any*/),
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "TodoItem_todo"
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
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "TodoListQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Todo",
        "kind": "LinkedField",
        "name": "todos",
        "plural": true,
        "selections": [
          (v0/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "title",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "done",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "id": "3f68cfe7f95fdfd770274ece724d3623c361f4a0c3a21e96fdfbf28d3d75153d",
    "metadata": {},
    "name": "TodoListQuery",
    "operationKind": "query",
    "text": null
  }
};
})();

(node as any).hash = "8ab750de5ed57ebdeb3172edc2a0f2f5";

export default node;
