import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'editor',
      component: () => import('../views/EditorPage.vue'),
    },
    {
      path: '/design-to-code',
      name: 'design-to-code',
      component: () => import('../views/DesignToCodePage.vue'),
    },
    {
      path: '/homework-review',
      name: 'homework-review',
      component: () => import('../views/HomeworkReviewPage.vue'),
    },
  ],
})

export default router
