/**
 * @generated SignedSource<<e748901374b67fc3909dda3c1662bcaa>>
 * @relayHash 404390c073f77a99c8c9faba4be2989c
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

// @relayRequestID ca3885e07dab7aa341848f8d0138896377bf5af08ce9e5106c59714b07e26adf

import { ConcreteRequest } from 'relay-runtime';
export type TodoDetailToggleMutation$variables = {
  id: string;
};
export type TodoDetailToggleMutation$data = {
  readonly toggleTodo: {
    readonly done: boolean;
    readonly id: string;
  };
};
export type TodoDetailToggleMutation = {
  response: TodoDetailToggleMutation$data;
  variables: TodoDetailToggleMutation$variables;
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
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "id",
        "variableName": "id"
      }
    ],
    "concreteType": "Todo",
    "kind": "LinkedField",
    "name": "toggleTodo",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "id",
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
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "TodoDetailToggleMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "TodoDetailToggleMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "id": "ca3885e07dab7aa341848f8d0138896377bf5af08ce9e5106c59714b07e26adf",
    "metadata": {},
    "name": "TodoDetailToggleMutation",
    "operationKind": "mutation",
    "text": null
  }
};
})();

(node as any).hash = "318dce9cbe026c87523959dea93ffff2";

export default node;
