/**
 * @generated SignedSource<<cfe2d2d6f17b6d7adf27418d3eadb48f>>
 * @relayHash 30ef258c910047cf3b32bbb07128f9d6
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

// @relayRequestID fdcca2996f159e3306fc76535a22a6d4afcfa77d41c15bd60b6bd119a64dbe88

import { ConcreteRequest } from 'relay-runtime';
export type UserListQuery$variables = Record<PropertyKey, never>;
export type UserListQuery$data = {
  readonly users: ReadonlyArray<{
    readonly email: string;
    readonly id: string;
    readonly name: string;
  }>;
};
export type UserListQuery = {
  response: UserListQuery$data;
  variables: UserListQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "User",
    "kind": "LinkedField",
    "name": "users",
    "plural": true,
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
        "name": "name",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "email",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "UserListQuery",
    "selections": (v0/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "UserListQuery",
    "selections": (v0/*:: as any*/)
  },
  "params": {
    "id": "fdcca2996f159e3306fc76535a22a6d4afcfa77d41c15bd60b6bd119a64dbe88",
    "metadata": {},
    "name": "UserListQuery",
    "operationKind": "query",
    "text": null
  }
};
})();

(node as any).hash = "8d7fdc38350d8db78e27b8949dbbfa6a";

export default node;
