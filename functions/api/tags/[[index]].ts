import type { Env, ICreateEditTagVM, ITagVM } from "../../types"
import { z } from "zod"
import { ApiDataResponse, ApiExceptionResponse, ApiErrorResponse } from "../../helpers.ts"

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context
  const result = await env.DB.prepare(`SELECT id, name FROM tags WHERE deleted=0`).all<ITagVM>()
  return new Response(JSON.stringify(result.results), { status: 200 })
}

export const onRequestPost: PagesFunction<Env> = async (context) =>  {
  const { env, request } = context
  try {
    const createTagVm = await request.json<ICreateEditTagVM>()

    createTagSchema.parse(createTagVm)

    if (createTagVm.id > 0) {
      return updateTag(env.DB, createTagVm)
    }

    return createTag(env.DB, createTagVm)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return ApiErrorResponse(400, 'Invalid request', { errors: err.errors })
    }

    return ApiExceptionResponse(err)
  }
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, request } = context
  const url = new URL(request.url)
  const parts = url.pathname.split('/')
  const id = parts.pop()
  await env.DB
    .prepare(`UPDATE tags SET deleted=1, deleted_at=CURRENT_TIMESTAMP WHERE id=?1`)
    .bind(id)
    .run()

  return new Response(JSON.stringify({ success: true }), { status: 200 })
}

async function createTag(db: D1Database, tag: ICreateEditTagVM): Promise<Response> {
  if (await doesTagExistByName(db, tag.name)) {
    return ApiErrorResponse(400, `Tag with name ${tag.name} already exists`)
  }

  const result = await db
    .prepare(`INSERT INTO tags (name, display_name, description) VALUES (?1, ?2, ?3) RETURNING id, name`)
    .bind(tag.name, tag.display_name ?? null, tag.description ?? null)
    .run()

  return ApiDataResponse(result.results[0])
}

async function updateTag(db: D1Database, tag: ICreateEditTagVM): Promise<Response> {
  if (!await doesTagExistById(db, tag.id)) {
    return ApiErrorResponse(400, `Tag with id ${tag.id} does not exist`)
  }

  const result = await db
    .prepare(`UPDATE tags SET name=?1, display_name=?2, description=?3, deleted=?4 WHERE id=?5 RETURNING id, name, display_name, description, deleted`)
    .bind(tag.name, tag.display_name ?? null, tag.description ?? null, tag.deleted ?? false, tag.id)
    .run()

  return ApiDataResponse(result.results[0])
}

async function doesTagExistByName(db: D1Database, name: string): Promise<boolean> {
  const result = await db.prepare(`SELECT id FROM tags WHERE name= ?`).bind(name).first()
  return !!result
}

async function doesTagExistById(db: D1Database, id: number): Promise<boolean> {
  const result = await db.prepare(`SELECT id FROM tags WHERE id= ?`).bind(id).first()
  return !!result
}

const createTagSchema = z.object({
  name: z.string()
    .min(2)
    .max(42)
    .regex(/^[a-z0-9:]+$/, "Name must only contain lowercase letters, numbers, and colons"),
  display_name: z.string().max(100).optional(),
  description: z.string().max(255).optional(),
  deleted: z.boolean().optional(),
})
