/**
 * @generated SignedSource<<c10838adb6d8a0cae36f93af631dd72f>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TodoItem_todo$data = {
  readonly done: boolean;
  readonly title: string;
  readonly " $fragmentType": "TodoItem_todo";
};
export type TodoItem_todo$key = {
  readonly " $data"?: TodoItem_todo$data;
  readonly " $fragmentSpreads": FragmentRefs<"TodoItem_todo">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "TodoItem_todo",
  "selections": [
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
  "type": "Todo",
  "abstractKey": null
};

(node as any).hash = "3884e8f0a8ce22808d37d7796cb587dd";

export default node;
