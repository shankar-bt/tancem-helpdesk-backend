import path from 'path';
import fs from 'fs';
import type { Request, Response } from 'express';
import { AppError } from '../../../shared/utils/app-error';
import { sendSuccess } from '../../../shared/utils/response';
import type { ListTicketsQuery } from '../schemas/ticket.schema';
import { ticketService } from '../services/ticket.service';

export const ticketController = {
  async list(req: Request, res: Response) {
    if (!req.user) throw AppError.unauthorized();
    const { items, meta } = await ticketService.list(req.query as unknown as ListTicketsQuery, req.user);
    return sendSuccess(res, items, 200, meta);
  },

  async getStats(req: Request, res: Response) {
    if (!req.user) throw AppError.unauthorized();
    return sendSuccess(res, await ticketService.getStats(req.user));
  },

  async getById(req: Request, res: Response) {
    if (!req.user) throw AppError.unauthorized();
    return sendSuccess(res, await ticketService.getById(req.params.id, req.user));
  },

  async create(req: Request, res: Response) {
    if (!req.user) throw AppError.unauthorized();
    return sendSuccess(res, await ticketService.create(req.body, req.user), 201);
  },

  async updateStatus(req: Request, res: Response) {
    if (!req.user) throw AppError.unauthorized();
    return sendSuccess(res, await ticketService.updateStatus(req.params.id, req.body, req.user));
  },

  async assign(req: Request, res: Response) {
    if (!req.user) throw AppError.unauthorized();
    return sendSuccess(res, await ticketService.assign(req.params.id, req.body, req.user));
  },

  async addComment(req: Request, res: Response) {
    if (!req.user) throw AppError.unauthorized();
    return sendSuccess(res, await ticketService.addComment(req.params.id, req.body, req.user), 201);
  },

  uploadAttachments(req: Request, res: Response) {
    const files = (req.files as Express.Multer.File[]) || (req.file ? [req.file as Express.Multer.File] : []);
    const results = files.map((file) => ({
      name: file.originalname,
      url: `/uploads/${file.filename}`,
      size: file.size,
      type: file.mimetype,
    }));
    return sendSuccess(res, results, 201);
  },

  async listComments(req: Request, res: Response) {
    if (!req.user) throw AppError.unauthorized();
    return sendSuccess(res, await ticketService.listComments(req.params.id, req.user));
  },
  async rate(req: Request, res: Response) {
    const rating = Number(req.body.rating);
    if (!rating || rating < 1 || rating > 5) {
      throw AppError.badRequest('Rating must be an integer between 1 and 5');
    }
    const updated = await ticketService.rate(
      req.params.id,
      { rating, feedback: req.body.feedback },
      req.user!
    );
    res.json({ success: true, data: updated });
  },

  async getHistory(req: Request, res: Response) {
    if (!req.user) throw AppError.unauthorized();
    return sendSuccess(res, await ticketService.getHistory(req.params.id, req.user));
  },
  serveAttachment(req: Request, res: Response) {
    const rawFilename = req.params.filename;
    if (!rawFilename) {
      throw AppError.badRequest('Filename parameter is required');
    }

    // Prevent path traversal attacks (e.g., ../../etc/passwd)
    const filename = path.basename(rawFilename);
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    const filePath = path.join(uploadsDir, filename);

    if (!fs.existsSync(filePath)) {
      throw AppError.notFound('Attachment not found');
    }

    // Security headers to prevent MIME sniffing and script execution
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");

    // Safe images are rendered inline, all documents/spreadsheets forced to download
    if (filename.match(/\.(png|jpe?g|webp)$/i)) {
      res.setHeader('Content-Disposition', 'inline');
    } else {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }

    return res.sendFile(filePath);
  },

};