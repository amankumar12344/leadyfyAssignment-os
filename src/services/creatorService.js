const db = require('../database/db');
const { logAudit } = require('./auditService');

async function createCreator(data, actorId = null) {
  const {
    name,
    photo_url = null,
    gender = 'Female',
    age_group = '20-25',
    languages = 'English, Hindi',
    location = 'Mumbai',
    niches = 'Beauty, Lifestyle',
    demographics = 'Gen-Z / Millennial',
    contact_email = null,
    phone = null,
    standard_rate = 0,
    bank_upi_info = null,
    portfolio_url = null,
    availability_status = 'AVAILABLE'
  } = data;

  if (!name || !name.trim()) throw new Error('Creator name is required.');

  const res = await db.run(`
    INSERT INTO creators (
      name, photo_url, gender, age_group, languages, location,
      niches, demographics, contact_email, phone, standard_rate,
      bank_upi_info, portfolio_url, availability_status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    name.trim(),
    photo_url,
    gender,
    age_group,
    languages,
    location,
    niches,
    demographics,
    contact_email,
    phone,
    parseFloat(standard_rate || 0),
    bank_upi_info,
    portfolio_url,
    availability_status
  ]);

  const newId = res.lastID;
  await logAudit({
    actor_id: actorId,
    action: 'CREATOR_CREATED',
    entity: 'CREATORS',
    entity_id: newId,
    metadata: { name, location, standard_rate }
  });

  return await getCreatorById(newId);
}

async function getCreatorById(id, isClient = false) {
  const creator = await db.get("SELECT * FROM creators WHERE id = ?", [id]);
  if (!creator) return null;

  // Mask sensitive financial data if requested by a client
  if (isClient) {
    delete creator.standard_rate;
    delete creator.bank_upi_info;
    delete creator.contact_email;
    delete creator.phone;
  }

  // Get upcoming shoot schedule
  const upcomingShoots = await db.all(`
    SELECT sh.id, sh.shoot_date, sh.shoot_time, sh.location, sh.status
    FROM shoots sh
    WHERE sh.creator_id = ? AND sh.status NOT IN ('CANCELLED', 'COMPLETED')
    ORDER BY sh.shoot_date ASC
  `, [id]);

  return {
    ...creator,
    upcomingShoots
  };
}

async function listCreators(filter = {}, isClient = false) {
  let query = "SELECT * FROM creators";
  const conditions = [];
  const params = [];

  if (filter.status) {
    conditions.push("availability_status = ?");
    params.push(filter.status);
  }

  if (filter.niche) {
    conditions.push("niches LIKE ?");
    params.push(`%${filter.niche}%`);
  }

  if (filter.search) {
    conditions.push("(name LIKE ? OR location LIKE ? OR niches LIKE ?)");
    const s = `%${filter.search}%`;
    params.push(s, s, s);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY name ASC";

  const creators = await db.all(query, params);

  if (isClient) {
    return creators.map(c => {
      const { standard_rate, bank_upi_info, contact_email, phone, ...safe } = c;
      return safe;
    });
  }

  return creators;
}

async function checkDoubleBooking(creatorId, shootDate, shootTime, excludeShootId = null) {
  let query = `
    SELECT id, shoot_date, shoot_time, location, status
    FROM shoots
    WHERE creator_id = ?
      AND shoot_date = ?
      AND status NOT IN ('CANCELLED')
  `;
  const params = [creatorId, shootDate];

  if (excludeShootId) {
    query += " AND id != ?";
    params.push(excludeShootId);
  }

  const conflictingShoots = await db.all(query, params);
  return conflictingShoots;
}

module.exports = {
  createCreator,
  getCreatorById,
  listCreators,
  checkDoubleBooking
};
