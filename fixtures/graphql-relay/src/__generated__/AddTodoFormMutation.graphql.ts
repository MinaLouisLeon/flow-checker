/**
 * @generated SignedSource<<128e76fb47749a04515235bb2202681b>>
 * @relayHash 3e99ea0a979d98760af6e88aec444b6b
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

// @relayRequestID 7b287a25c92827de62ee76b0bdbdc3a1f06652f85ea710168f89cd568052bf8d

import { ConcreteRequest } from 'relay-runtime';
export type AddTodoInput = {
  ownerId?: string | null | undefined;
  title: string;
};
export type AddTodoFormMutation$variables = {
  input: AddTodoInput;
};
export type AddTodoFormMutation$data = {
  readonly addTodo: {
    readonly id: string;
    readonly title: string;
  };
};
export type AddTodoFormMutation = {
  response: AddTodoFormMutation$data;
  variables: AddTodoFormMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "Todo",
    "kind": "LinkedField",
    "name": "addTodo",
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
        "name": "title",
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
    "name": "AddTodoFormMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "AddTodoFormMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "id": "7b287a25c92827de62ee76b0bdbdc3a1f06652f85ea710168f89cd568052bf8d",
    "metadata": {},
    "name": "AddTodoFormMutation",
    "operationKind": "mutation",
    "text": null
  }
};
})();

(node as any).hash = "be191f1fe7c7620020d88d924ad1e25b";

export default node;
