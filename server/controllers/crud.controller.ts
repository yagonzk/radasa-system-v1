import type { Request, Response } from "express";

export type CrudService = { list(): Promise<unknown>; get(id: string): Promise<unknown>; create(data: any): Promise<unknown>; update(id: string, data: any): Promise<unknown>; remove(id: string): Promise<unknown> };
export const crudController = (service: CrudService) => ({
  list: async (_req: Request, res: Response) => res.json(await service.list()),
  get: async (req: Request, res: Response) => res.json(await service.get(req.params.id)),
  create: async (req: Request, res: Response) => res.status(201).json(await service.create(req.body)),
  update: async (req: Request, res: Response) => res.json(await service.update(req.params.id, req.body)),
  remove: async (req: Request, res: Response) => { await service.remove(req.params.id); res.status(204).send(); },
});
