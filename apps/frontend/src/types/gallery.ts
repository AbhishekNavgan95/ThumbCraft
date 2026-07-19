export type TemplateCategory = {
  id: string
  slug: string
  name: string
  description: string | null
  sortOrder: number
  active: boolean
  templateCount?: number
  createdAt: string
  updatedAt: string
}

export type CategoriesResponse = {
  categories: TemplateCategory[]
}
