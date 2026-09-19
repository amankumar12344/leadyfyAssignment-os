-- Leadyfy OS Normalized Relational Schema

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('OWNER', 'ADMIN', 'EMPLOYEE', 'CLIENT')),
  sub_role TEXT CHECK(sub_role IN ('SALES', 'SCRIPT_WRITER', 'SHOOT_MANAGER', 'EDITOR', 'OPERATIONS_MANAGER', 'NONE')),
  phone TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS roles_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL,
  sub_role TEXT,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  allowed INTEGER DEFAULT 1,
  UNIQUE(role, sub_role, resource, action)
);

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,
  department TEXT NOT NULL,
  salary REAL DEFAULT 0,
  joining_date DATE,
  skills TEXT,
  performance_rating REAL DEFAULT 5.0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- CRITICAL FIX: company_name column is strictly defined and normalized
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE,
  client_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  brand_name TEXT,
  industry TEXT,
  gst_tax_id TEXT,
  assigned_employee_id INTEGER,
  source TEXT,
  brand_kit_url TEXT,
  status TEXT DEFAULT 'NEW' CHECK(status IN ('LEAD', 'NEW', 'ONBOARDING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'INACTIVE')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_employee_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_company ON clients(company_name);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  package_name TEXT NOT NULL,
  video_count INTEGER NOT NULL CHECK(video_count > 0),
  pricing REAL NOT NULL,
  gst_rate REAL DEFAULT 18.0,
  gst_amount REAL DEFAULT 0,
  total_amount REAL NOT NULL,
  amount_received REAL DEFAULT 0,
  outstanding_balance REAL NOT NULL,
  start_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status TEXT DEFAULT 'NEW' CHECK(status IN ('NEW', 'ONBOARDING', 'IN_PRODUCTION', 'PARTIALLY_DELIVERED', 'COMPLETED', 'ON_HOLD', 'CANCELLED')),
  assigned_team_id INTEGER,
  assigned_videos_count INTEGER DEFAULT 0,
  completed_videos_count INTEGER DEFAULT 0,
  delivered_videos_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_team_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_client ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS creators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  photo_url TEXT,
  gender TEXT,
  age_group TEXT,
  languages TEXT,
  location TEXT,
  niches TEXT,
  demographics TEXT,
  contact_email TEXT UNIQUE,
  phone TEXT,
  standard_rate REAL DEFAULT 0,
  bank_upi_info TEXT,
  portfolio_url TEXT,
  availability_status TEXT DEFAULT 'AVAILABLE' CHECK(availability_status IN ('AVAILABLE', 'BOOKED', 'UNAVAILABLE', 'ON_HOLD')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scripts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL,
  video_number INTEGER DEFAULT 1,
  title TEXT NOT NULL,
  language TEXT DEFAULT 'English',
  script_text TEXT,
  reference_links TEXT,
  writer_id INTEGER,
  creator_id INTEGER,
  deadline DATE,
  revision_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'ASSIGNED', 'IN_REVIEW', 'SENT_TO_CLIENT', 'REVISION_REQUIRED', 'APPROVED', 'READY_FOR_SHOOT')),
  client_comments TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (writer_id) REFERENCES employees(id) ON DELETE SET NULL,
  FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_scripts_client ON scripts(client_id);
CREATE INDEX IF NOT EXISTS idx_scripts_order ON scripts(order_id);
CREATE INDEX IF NOT EXISTS idx_scripts_status ON scripts(status);

CREATE TABLE IF NOT EXISTS shoots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL,
  shoot_date DATE NOT NULL,
  shoot_time TEXT NOT NULL,
  location TEXT NOT NULL,
  creator_id INTEGER NOT NULL,
  cameraman TEXT,
  shoot_manager_id INTEGER,
  assistant TEXT,
  approved_scripts_summary TEXT,
  special_notes TEXT,
  status TEXT DEFAULT 'SCHEDULED' CHECK(status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'RESHOOT_REQUIRED')),
  pre_shoot_checklist TEXT DEFAULT '{"scriptApproved":true,"creatorConfirmed":false,"locationPermission":false,"productReceived":false,"teamBriefing":false}',
  post_shoot_checklist TEXT DEFAULT '{"footageUploaded":false,"rawFootageVerified":false,"reshootNeeded":false}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE RESTRICT,
  FOREIGN KEY (shoot_manager_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_shoots_date ON shoots(shoot_date);
CREATE INDEX IF NOT EXISTS idx_shoots_creator ON shoots(creator_id);

CREATE TABLE IF NOT EXISTS creator_availability (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id INTEGER NOT NULL,
  shoot_id INTEGER,
  booked_from DATETIME NOT NULL,
  booked_to DATETIME NOT NULL,
  status TEXT DEFAULT 'BOOKED' CHECK(status IN ('AVAILABLE', 'BOOKED', 'UNAVAILABLE', 'ON_HOLD')),
  notes TEXT,
  FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE CASCADE,
  FOREIGN KEY (shoot_id) REFERENCES shoots(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL,
  script_id INTEGER,
  creator_id INTEGER,
  shoot_id INTEGER,
  assigned_editor_id INTEGER,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'SCRIPT_APPROVED' CHECK(status IN (
    'SCRIPT_APPROVED',
    'SHOOT_PENDING',
    'RAW_FOOTAGE_RECEIVED',
    'VIDEO_EDITING',
    'INTERNAL_QA',
    'CLIENT_REVIEW',
    'REVISION',
    'FINAL_APPROVED',
    'DELIVERED'
  )),
  deadline DATE,
  raw_footage_url TEXT,
  draft_video_url TEXT,
  thumbnail_url TEXT,
  final_delivery_link TEXT,
  revision_count INTEGER DEFAULT 0,
  completed_at DATETIME,
  delivered_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE SET NULL,
  FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE SET NULL,
  FOREIGN KEY (shoot_id) REFERENCES shoots(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_editor_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_videos_client ON videos(client_id);
CREATE INDEX IF NOT EXISTS idx_videos_order ON videos(order_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_editor ON videos(assigned_editor_id);

CREATE TABLE IF NOT EXISTS video_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  revision_number INTEGER NOT NULL,
  timestamp_seconds REAL,
  comment TEXT NOT NULL,
  resolved INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  assigned_user_id INTEGER,
  priority TEXT DEFAULT 'MEDIUM' CHECK(priority IN ('URGENT', 'HIGH', 'MEDIUM', 'LOW')),
  status TEXT DEFAULT 'TODO' CHECK(status IN ('TODO', 'IN_PROGRESS', 'DONE')),
  deadline DATE,
  attachment_url TEXT,
  order_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL,
  invoice_number TEXT UNIQUE NOT NULL,
  invoice_amount REAL NOT NULL,
  amount_received REAL DEFAULT 0,
  outstanding_balance REAL NOT NULL,
  payment_date DATE,
  payment_method TEXT,
  transaction_ref TEXT,
  notes TEXT,
  status TEXT DEFAULT 'UNPAID' CHECK(status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL CHECK(category IN ('Salaries', 'Office', 'Studio', 'Equipment', 'Fuel', 'Software', 'Other')),
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  recorded_by_user_id INTEGER,
  date DATE NOT NULL,
  receipt_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recorded_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS creator_payouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL,
  video_count INTEGER NOT NULL DEFAULT 1,
  agreed_rate REAL NOT NULL,
  total_payout REAL NOT NULL,
  status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'PAID')),
  payment_date DATE,
  reference_number TEXT,
  approved_by_user_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  -- Constraint to prevent duplicate payout for the exact same order and creator
  UNIQUE(creator_id, order_id),
  FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE RESTRICT,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  event_type TEXT NOT NULL,
  reference_id INTEGER,
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

CREATE TABLE IF NOT EXISTS support_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT DEFAULT 'MEDIUM' CHECK(priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  status TEXT DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED')),
  assigned_employee_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_employee_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ticket_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  is_client INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id INTEGER,
  metadata TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_logs(entity, entity_id);

CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  order_id INTEGER,
  asset_type TEXT NOT NULL CHECK(asset_type IN ('BRAND_KIT', 'RAW_FOOTAGE', 'FINAL_VIDEO', 'DOCUMENT', 'THUMBNAIL', 'OTHER')),
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  uploaded_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);
