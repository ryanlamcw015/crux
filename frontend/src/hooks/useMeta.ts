import { useEffect, useState } from 'react'
import { api } from '../api/endpoints'
import type { Meta } from '../types'

let cached: Promise<Meta> | null = null

/** Grade lists, rock types etc. Fetched once per page load and shared. */
export function useMeta(): Meta | null {
  const [meta, setMeta] = useState<Meta | null>(null)
  useEffect(() => {
    cached ??= api.meta().catch((err) => {
      cached = null
      throw err
    })
    cached.then(setMeta).catch(() => undefined)
  }, [])
  return meta
}
