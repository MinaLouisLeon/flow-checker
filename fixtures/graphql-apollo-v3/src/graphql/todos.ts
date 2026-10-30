import { gql } from '@apollo/client'

export const TODO_FIELDS = gql`
  fragment TodoFields on Todo {
    id
    title
    done
  }
`

export const GET_TODOS = gql`
  query Todos {
    todos {
      ...TodoFields
    }
  }
  ${TODO_FIELDS}
`

export const GET_TODO = gql`
  query Todo($id: ID!) {
    todo(id: $id) {
      ...TodoFields
      status
      owner {
        id
        name
      }
    }
  }
  ${TODO_FIELDS}
`

export const ADD_TODO = gql`
  mutation AddTodo($input: AddTodoInput!) {
    addTodo(input: $input) {
      ...TodoFields
    }
  }
  ${TODO_FIELDS}
`

export const DELETE_TODO = gql`
  mutation DeleteTodo($id: ID!) {
    deleteTodo(id: $id)
  }
`

export const GET_VIEWER = gql`
  query Viewer {
    viewer {
      id
      name
      email
    }
  }
`

export const SEARCH = gql`
  query Search($text: String!) {
    search(text: $text) {
      __typename
      ... on Todo {
        id
        title
      }
      ... on User {
        id
        name
      }
    }
  }
`
