const { pool } = require('../config/db');

const ALLOWED_STATUSES = ['Active', 'Paused', 'Completed'];

/**
 * Validates whether an ID parameter is a positive integer.
 * @param {string|number} id
 * @returns {number|null}
 */
function parseValidId(id) {
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

/**
 * Normalizes status strings (e.g. "active" -> "Active").
 * @param {string} status
 * @returns {string|null}
 */
function normalizeStatus(status) {
  if (!status || typeof status !== 'string') return null;
  const trimmed = status.trim().toLowerCase();
  const found = ALLOWED_STATUSES.find((s) => s.toLowerCase() === trimmed);
  return found || null;
}

/**
 * GET /api/campaigns
 * Retrieves all campaigns belonging to the authenticated user.
 * Supports optional query params: ?search=keyword and ?status=Active
 */
async function getCampaigns(req, res, next) {
  try {
    const userId = req.user.id;
    const { search, status } = req.query;

    let sql = 'SELECT id, user_id, campaign_name, status, created_at FROM campaigns WHERE user_id = ?';
    const params = [userId];

    if (search && typeof search === 'string' && search.trim() !== '') {
      sql += ' AND campaign_name LIKE ?';
      params.push(`%${search.trim()}%`);
    }

    if (status && typeof status === 'string' && status.trim() !== '') {
      const validStatus = normalizeStatus(status);
      if (!validStatus) {
        return res.status(400).json({
          success: false,
          message: `Invalid status filter. Allowed values: ${ALLOWED_STATUSES.join(', ')}`,
        });
      }
      sql += ' AND status = ?';
      params.push(validStatus);
    }

    sql += ' ORDER BY created_at DESC, id DESC';

    const [rows] = await pool.execute(sql, params);

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/campaigns/stats
 * Returns aggregated statistics for the authenticated user.
 */
async function getCampaignStats(req, res, next) {
  try {
    const userId = req.user.id;

    const [rows] = await pool.execute(
      `SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status = 'Paused' THEN 1 ELSE 0 END) AS paused,
        SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed
      FROM campaigns
      WHERE user_id = ?`,
      [userId]
    );

    const stats = rows[0] || {};

    return res.status(200).json({
      success: true,
      data: {
        total: Number(stats.total) || 0,
        active: Number(stats.active) || 0,
        paused: Number(stats.paused) || 0,
        completed: Number(stats.completed) || 0,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/campaigns/:id
 * Retrieves a single campaign by ID, ensuring user ownership.
 */
async function getCampaignById(req, res, next) {
  try {
    const campaignId = parseValidId(req.params.id);
    if (!campaignId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid campaign ID. Must be a positive integer.',
      });
    }

    const userId = req.user.id;

    const [rows] = await pool.execute(
      'SELECT id, user_id, campaign_name, status, created_at FROM campaigns WHERE id = ? AND user_id = ?',
      [campaignId, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found.',
      });
    }

    return res.status(200).json({
      success: true,
      data: rows[0],
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/campaigns
 * Creates a new campaign for the authenticated user.
 */
async function createCampaign(req, res, next) {
  try {
    const userId = req.user.id;
    const { campaign_name, status } = req.body;

    // Validate campaign_name
    if (!campaign_name || typeof campaign_name !== 'string' || campaign_name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Campaign name is required.',
      });
    }
    const cleanName = campaign_name.trim();
    if (cleanName.length > 150) {
      return res.status(400).json({
        success: false,
        message: 'Campaign name cannot exceed 150 characters.',
      });
    }

    // Validate status (defaults to 'Active')
    let cleanStatus = 'Active';
    if (status !== undefined && status !== null && status !== '') {
      const valid = normalizeStatus(status);
      if (!valid) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(', ')}`,
        });
      }
      cleanStatus = valid;
    }

    // Insert campaign
    const [result] = await pool.execute(
      'INSERT INTO campaigns (user_id, campaign_name, status) VALUES (?, ?, ?)',
      [userId, cleanName, cleanStatus]
    );

    // Fetch newly created record
    const [rows] = await pool.execute(
      'SELECT id, user_id, campaign_name, status, created_at FROM campaigns WHERE id = ? AND user_id = ?',
      [result.insertId, userId]
    );

    return res.status(201).json({
      success: true,
      message: 'Campaign created successfully.',
      data: rows[0],
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/campaigns/:id
 * Updates an existing campaign belonging to the authenticated user.
 */
async function updateCampaign(req, res, next) {
  try {
    const campaignId = parseValidId(req.params.id);
    if (!campaignId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid campaign ID. Must be a positive integer.',
      });
    }

    const userId = req.user.id;
    const { campaign_name, status } = req.body;

    if (campaign_name === undefined && status === undefined) {
      return res.status(400).json({
        success: false,
        message: 'At least one field (campaign_name or status) must be provided to update.',
      });
    }

    // Verify campaign exists and belongs to this user
    const [existing] = await pool.execute(
      'SELECT id FROM campaigns WHERE id = ? AND user_id = ?',
      [campaignId, userId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found.',
      });
    }

    const updates = [];
    const params = [];

    if (campaign_name !== undefined) {
      if (typeof campaign_name !== 'string' || campaign_name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Campaign name cannot be empty.',
        });
      }
      const cleanName = campaign_name.trim();
      if (cleanName.length > 150) {
        return res.status(400).json({
          success: false,
          message: 'Campaign name cannot exceed 150 characters.',
        });
      }
      updates.push('campaign_name = ?');
      params.push(cleanName);
    }

    if (status !== undefined) {
      const valid = normalizeStatus(status);
      if (!valid) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(', ')}`,
        });
      }
      updates.push('status = ?');
      params.push(valid);
    }

    params.push(campaignId, userId);

    await pool.execute(
      `UPDATE campaigns SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      params
    );

    const [updatedRows] = await pool.execute(
      'SELECT id, user_id, campaign_name, status, created_at FROM campaigns WHERE id = ? AND user_id = ?',
      [campaignId, userId]
    );

    return res.status(200).json({
      success: true,
      message: 'Campaign updated successfully.',
      data: updatedRows[0],
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/campaigns/:id
 * Deletes an existing campaign belonging to the authenticated user.
 */
async function deleteCampaign(req, res, next) {
  try {
    const campaignId = parseValidId(req.params.id);
    if (!campaignId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid campaign ID. Must be a positive integer.',
      });
    }

    const userId = req.user.id;

    // Verify campaign exists and belongs to this user
    const [existing] = await pool.execute(
      'SELECT id FROM campaigns WHERE id = ? AND user_id = ?',
      [campaignId, userId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found.',
      });
    }

    await pool.execute('DELETE FROM campaigns WHERE id = ? AND user_id = ?', [
      campaignId,
      userId,
    ]);

    return res.status(200).json({
      success: true,
      message: 'Campaign deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCampaigns,
  getCampaignStats,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
};

