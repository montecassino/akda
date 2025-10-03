import {
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import MainWindow from './components/layout/MainWindow'
import MainWindowContent from './components/layout/MainWindowContent'
import { Editor } from './components/editor'

export const rootRoute = createRootRoute({
  component: MainWindow,
})

export const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: MainWindowContent,
})

export const editorRoute = createRoute({
  path: '/editor/$id',
  component: Editor,
  getParentRoute: () => rootRoute,
})

export const routeTree = rootRoute.addChildren([homeRoute, editorRoute])

export const router = createRouter({ routeTree })
