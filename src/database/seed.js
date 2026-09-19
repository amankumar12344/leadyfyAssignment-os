const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');

async function seed() {
  console.log('Initializing database schema...');
  await db.init();

  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await db.exec(schemaSql);

  // Check if already seeded
  const existingUsers = await db.get("SELECT COUNT(*) as count FROM users;");
  if (existingUsers && existingUsers.count > 0) {
    console.log(`Database already contains ${existingUsers.count} users. Skipping seed.`);
    return;
  }

  console.log('Seeding initial data...');
  const passwordHash = await bcrypt.hash('password123', 10);

  await db.transaction(async () => {
    // 1. Users
    const u1 = await db.run(`
      INSERT INTO users (email, password_hash, full_name, role, sub_role, phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['owner@leadyfy.com', passwordHash, 'Vikram Malhotra', 'OWNER', 'NONE', '+91 9811001122']);

    const u2 = await db.run(`
      INSERT INTO users (email, password_hash, full_name, role, sub_role, phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['admin@leadyfy.com', passwordHash, 'Neha Kapoor', 'ADMIN', 'OPERATIONS_MANAGER', '+91 9822002233']);

    const u3 = await db.run(`
      INSERT INTO users (email, password_hash, full_name, role, sub_role, phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['writer@leadyfy.com', passwordHash, 'Aryan Saxena', 'EMPLOYEE', 'SCRIPT_WRITER', '+91 9833003344']);

    const u4 = await db.run(`
      INSERT INTO users (email, password_hash, full_name, role, sub_role, phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['shootmgr@leadyfy.com', passwordHash, 'Sameer Joshi', 'EMPLOYEE', 'SHOOT_MANAGER', '+91 9844004455']);

    const u5 = await db.run(`
      INSERT INTO users (email, password_hash, full_name, role, sub_role, phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['editor@leadyfy.com', passwordHash, 'Karan Grover', 'EMPLOYEE', 'EDITOR', '+91 9855005566']);

    const u6 = await db.run(`
      INSERT INTO users (email, password_hash, full_name, role, sub_role, phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['sales@leadyfy.com', passwordHash, 'Anjali Roy', 'EMPLOYEE', 'SALES', '+91 9866006677']);

    const u7 = await db.run(`
      INSERT INTO users (email, password_hash, full_name, role, sub_role, phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['client1@glowbeauty.com', passwordHash, 'Priya Sharma', 'CLIENT', 'NONE', '+91 9877007788']);

    const u8 = await db.run(`
      INSERT INTO users (email, password_hash, full_name, role, sub_role, phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['client2@fitfuel.com', passwordHash, 'Rahul Verma', 'CLIENT', 'NONE', '+91 9888008899']);

    // 2. Employees
    const empAdmin = await db.run(`
      INSERT INTO employees (user_id, department, salary, joining_date, skills)
      VALUES (?, ?, ?, ?, ?)
    `, [u2.lastID, 'Operations', 95000, '2025-01-10', 'Management, Logistics, Client Relations']);

    const empWriter = await db.run(`
      INSERT INTO employees (user_id, department, salary, joining_date, skills)
      VALUES (?, ?, ?, ?, ?)
    `, [u3.lastID, 'Creative', 65000, '2025-02-01', 'Copywriting, Hook Design, UGC Concepts']);

    const empShoot = await db.run(`
      INSERT INTO employees (user_id, department, salary, joining_date, skills)
      VALUES (?, ?, ?, ?, ?)
    `, [u4.lastID, 'Production', 70000, '2025-02-15', 'Directing, Lighting, Creator Coordination']);

    const empEditor = await db.run(`
      INSERT INTO employees (user_id, department, salary, joining_date, skills)
      VALUES (?, ?, ?, ?, ?)
    `, [u5.lastID, 'Post-Production', 75000, '2025-03-01', 'Premiere Pro, After Effects, CapCut, Sound Design']);

    const empSales = await db.run(`
      INSERT INTO employees (user_id, department, salary, joining_date, skills)
      VALUES (?, ?, ?, ?, ?)
    `, [u6.lastID, 'Growth', 60000, '2025-03-15', 'Pitching, Onboarding, Contract Closing']);

    // 3. Clients (Strictly populated with company_name)
    const c1 = await db.run(`
      INSERT INTO clients (user_id, client_name, company_name, email, phone, whatsapp, brand_name, industry, gst_tax_id, assigned_employee_id, source, brand_kit_url, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      u7.lastID,
      'Priya Sharma',
      'Glow Beauty Private Limited',
      'client1@glowbeauty.com',
      '+91 9877007788',
      '+91 9877007788',
      'Glow Beauty',
      'Cosmetics & Skincare',
      '07AAAAA0000A1Z5',
      empSales.lastID,
      'Direct Referral',
      'https://drive.google.com/drive/folders/glowbeauty-brandkit',
      'ACTIVE'
    ]);

    const c2 = await db.run(`
      INSERT INTO clients (user_id, client_name, company_name, email, phone, whatsapp, brand_name, industry, gst_tax_id, assigned_employee_id, source, brand_kit_url, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      u8.lastID,
      'Rahul Verma',
      'FitFuel India Brands Ltd',
      'client2@fitfuel.com',
      '+91 9888008899',
      '+91 9888008899',
      'FitFuel',
      'Health & Supplements',
      '07BBBBB1111B2Z6',
      empSales.lastID,
      'Inbound Ad',
      'https://drive.google.com/drive/folders/fitfuel-brandkit',
      'ONBOARDING'
    ]);

    // 4. Creators
    const cr1 = await db.run(`
      INSERT INTO creators (name, photo_url, gender, age_group, languages, location, niches, demographics, contact_email, phone, standard_rate, bank_upi_info, portfolio_url, availability_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'Aanya Sen',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
      'Female',
      '20-25',
      'English, Hindi',
      'Mumbai, Maharashtra',
      'Beauty, Skincare, Fashion',
      'Tier 1 Urban Gen-Z / Millennial',
      'aanya.creators@gmail.com',
      '+91 9911223344',
      12000,
      'aanya@oksbi / HDFC0001234',
      'https://instagram.com/aanya_lifestyle',
      'AVAILABLE'
    ]);

    const cr2 = await db.run(`
      INSERT INTO creators (name, photo_url, gender, age_group, languages, location, niches, demographics, contact_email, phone, standard_rate, bank_upi_info, portfolio_url, availability_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'Rohan Mehta',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
      'Male',
      '25-30',
      'English, Hindi, Punjabi',
      'Delhi NCR',
      'Fitness, Wellness, Tech',
      'Active Urban Males 20-35',
      'rohan.fitness@gmail.com',
      '+91 9922334455',
      15000,
      'rohan@icici / ICIC0005678',
      'https://instagram.com/rohan_fits',
      'AVAILABLE'
    ]);

    const cr3 = await db.run(`
      INSERT INTO creators (name, photo_url, gender, age_group, languages, location, niches, demographics, contact_email, phone, standard_rate, bank_upi_info, portfolio_url, availability_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'Kavita Rao',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400',
      'Female',
      '25-30',
      'English, Kannada, Hindi',
      'Bangalore, Karnataka',
      'Lifestyle, Home, Culinary',
      'Young Families / Professionals',
      'kavita.rao@gmail.com',
      '+91 9933445566',
      14000,
      'kavita@okhdfcbank',
      'https://instagram.com/kavita_living',
      'AVAILABLE'
    ]);

    // 5. Orders
    // Order 1: 10 videos, 2 completed, 1 delivered
    const o1 = await db.run(`
      INSERT INTO orders (client_id, package_name, video_count, pricing, gst_rate, gst_amount, total_amount, amount_received, outstanding_balance, start_date, due_date, status, assigned_team_id, assigned_videos_count, completed_videos_count, delivered_videos_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      c1.lastID,
      '10 UGC Growth Bundle',
      10,
      120000,
      18.0,
      21600,
      141600,
      100000,
      41600,
      '2026-09-01',
      '2026-09-30',
      'IN_PRODUCTION',
      empAdmin.lastID,
      4,
      2,
      1
    ]);

    // Order 2: 5 videos, new onboarding
    const o2 = await db.run(`
      INSERT INTO orders (client_id, package_name, video_count, pricing, gst_rate, gst_amount, total_amount, amount_received, outstanding_balance, start_date, due_date, status, assigned_team_id, assigned_videos_count, completed_videos_count, delivered_videos_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      c2.lastID,
      '5 High-Hook UGC Starter Pack',
      5,
      65000,
      18.0,
      11700,
      76700,
      38350,
      38350,
      '2026-09-15',
      '2026-10-15',
      'ONBOARDING',
      empAdmin.lastID,
      1,
      0,
      0
    ]);

    // 6. Scripts
    const s1 = await db.run(`
      INSERT INTO scripts (client_id, order_id, video_number, title, language, script_text, reference_links, writer_id, creator_id, deadline, revision_count, status, client_comments)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      c1.lastID,
      o1.lastID,
      1,
      'Hyaluronic Serum 3-Second Morning Routine Hook',
      'English',
      '[Hook 00:00-00:03]: "Stop washing your face like it\'s 2018! If your skin still feels tight after moisturizing, you skipped this 1 step."\n\n[Body 00:04-00:20]: Show close-up applying 3 drops of Glow Beauty Hyaluronic Dew Serum on damp skin. Emphasize lightweight glass skin finish.\n\n[CTA 00:21-00:30]: "Get 20% off with code GLOW20 in the link below."',
      'https://tiktok.com/@inspiration/skincare-hook-99',
      empWriter.lastID,
      cr1.lastID,
      '2026-09-05',
      1,
      'READY_FOR_SHOOT',
      'Loved the hook! Make sure the bottle logo is visible in the opening frame.'
    ]);

    const s2 = await db.run(`
      INSERT INTO scripts (client_id, order_id, video_number, title, language, script_text, reference_links, writer_id, creator_id, deadline, revision_count, status, client_comments)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      c1.lastID,
      o1.lastID,
      2,
      'Before & After 7-Day Hydration Testimonial',
      'English',
      '[Hook 00:00-00:04]: "My dermatologist asked what changed in my skincare routine this week..."\n\n[Body 00:05-00:22]: Side-by-side comparison of dull skin vs radiant skin after 7 days using Glow Beauty Serum.\n\n[CTA 00:23-00:30]: "Tap link in bio to try it risk-free for 30 days."',
      'https://tiktok.com/@inspiration/beauty-before-after',
      empWriter.lastID,
      cr1.lastID,
      '2026-09-08',
      0,
      'APPROVED',
      'Approved. Ready for shoot scheduling.'
    ]);

    const s3 = await db.run(`
      INSERT INTO scripts (client_id, order_id, video_number, title, language, script_text, reference_links, writer_id, creator_id, deadline, revision_count, status, client_comments)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      c1.lastID,
      o1.lastID,
      3,
      'Day to Night Sunscreen Mist Review',
      'English',
      '[Hook 00:00-00:03]: "Reapplying sunscreen over makeup without ruining it is actually possible now."',
      '',
      empWriter.lastID,
      cr1.lastID,
      '2026-09-22',
      0,
      'SENT_TO_CLIENT',
      'Pending client review.'
    ]);

    // 7. Shoots
    const sh1 = await db.run(`
      INSERT INTO shoots (client_id, order_id, shoot_date, shoot_time, location, creator_id, cameraman, shoot_manager_id, assistant, approved_scripts_summary, special_notes, status, pre_shoot_checklist, post_shoot_checklist)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      c1.lastID,
      o1.lastID,
      '2026-09-10',
      '11:00 AM',
      'Studio Lumiere, Bandra West, Mumbai',
      cr1.lastID,
      'Arun Kumar',
      empShoot.lastID,
      'Meera Sen',
      'Script #1 (Morning Routine) & Script #2 (7-Day Testimonial)',
      'Natural morning daylight setup, ring light with 5600K color temp, clean white background',
      'COMPLETED',
      '{"scriptApproved":true,"creatorConfirmed":true,"locationPermission":true,"productReceived":true,"teamBriefing":true}',
      '{"footageUploaded":true,"rawFootageVerified":true,"reshootNeeded":false}'
    ]);

    // Creator availability entry
    await db.run(`
      INSERT INTO creator_availability (creator_id, shoot_id, booked_from, booked_to, status, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [cr1.lastID, sh1.lastID, '2026-09-10 10:00:00', '2026-09-10 15:00:00', 'BOOKED', 'Shoot #1 for Glow Beauty completed']);

    // 8. Videos (Covering different state machine stages)
    // Video 1: DELIVERED (Final Approved & delivered)
    const v1 = await db.run(`
      INSERT INTO videos (client_id, order_id, script_id, creator_id, shoot_id, assigned_editor_id, title, status, deadline, raw_footage_url, draft_video_url, thumbnail_url, final_delivery_link, revision_count, completed_at, delivered_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      c1.lastID,
      o1.lastID,
      s1.lastID,
      cr1.lastID,
      sh1.lastID,
      empEditor.lastID,
      'Glow Beauty - Video #1: Morning Dew Routine',
      'DELIVERED',
      '2026-09-14',
      'https://drive.google.com/drive/folders/glow-raw-01',
      'https://storage.googleapis.com/leadyfy-demo/video1_draft.mp4',
      'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=500',
      'https://drive.google.com/file/d/glow-final-4k-master-v1/view?usp=sharing',
      1,
      '2026-09-15 14:30:00',
      '2026-09-15 15:00:00'
    ]);

    // Video 2: In CLIENT_REVIEW (awaiting client approval/revision)
    const v2 = await db.run(`
      INSERT INTO videos (client_id, order_id, script_id, creator_id, shoot_id, assigned_editor_id, title, status, deadline, raw_footage_url, draft_video_url, thumbnail_url, final_delivery_link, revision_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      c1.lastID,
      o1.lastID,
      s2.lastID,
      cr1.lastID,
      sh1.lastID,
      empEditor.lastID,
      'Glow Beauty - Video #2: 7-Day Hydration Results',
      'CLIENT_REVIEW',
      '2026-09-20',
      'https://drive.google.com/drive/folders/glow-raw-02',
      'https://storage.googleapis.com/leadyfy-demo/video2_draft.mp4',
      'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=500',
      null,
      0
    ]);

    // Video 3: Under VIDEO_EDITING
    const v3 = await db.run(`
      INSERT INTO videos (client_id, order_id, script_id, creator_id, shoot_id, assigned_editor_id, title, status, deadline, raw_footage_url, draft_video_url, thumbnail_url, final_delivery_link, revision_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      c1.lastID,
      o1.lastID,
      s3.lastID,
      cr1.lastID,
      null,
      empEditor.lastID,
      'Glow Beauty - Video #3: Sunscreen Mist Day Test',
      'VIDEO_EDITING',
      '2026-09-24',
      'https://drive.google.com/drive/folders/glow-raw-03',
      null,
      'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=500',
      null,
      0
    ]);

    // 9. Video Feedback for Video 1 (Historical)
    await db.run(`
      INSERT INTO video_feedback (video_id, client_id, revision_number, timestamp_seconds, comment, resolved)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      v1.lastID,
      c1.lastID,
      1,
      4.5,
      'Font color on caption at 00:04 is hard to read against the white countertop. Please add subtle black stroke or backing box.',
      1
    ]);

    // 10. Financials
    // Payment 1 for Order 1
    await db.run(`
      INSERT INTO payments (client_id, order_id, invoice_number, invoice_amount, amount_received, outstanding_balance, payment_date, payment_method, transaction_ref, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      c1.lastID,
      o1.lastID,
      'INV-2026-001',
      141600,
      100000,
      41600,
      '2026-09-02',
      'Bank Transfer (NEFT)',
      'NEFT889922001',
      'Initial 70% advance payment received',
      'PARTIALLY_PAID'
    ]);

    // Payment 2 for Order 2
    await db.run(`
      INSERT INTO payments (client_id, order_id, invoice_number, invoice_amount, amount_received, outstanding_balance, payment_date, payment_method, transaction_ref, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      c2.lastID,
      o2.lastID,
      'INV-2026-002',
      76700,
      38350,
      38350,
      '2026-09-16',
      'Razorpay UPI',
      'pay_UPI99223311',
      '50% deposit received on contract sign',
      'PARTIALLY_PAID'
    ]);

    // Expenses
    await db.run(`
      INSERT INTO expenses (category, description, amount, recorded_by_user_id, date, receipt_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['Studio', 'Studio Lumiere Rental for 5 Hours', 15000, u2.lastID, '2026-09-10', 'https://receipts.leadyfy.com/rec-0910-studio.pdf']);

    await db.run(`
      INSERT INTO expenses (category, description, amount, recorded_by_user_id, date, receipt_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['Equipment', 'Wireless Mic DJI Mic 2 Battery Rental & SD Cards', 3500, u4.lastID, '2026-09-10', 'https://receipts.leadyfy.com/rec-0910-mic.pdf']);

    await db.run(`
      INSERT INTO expenses (category, description, amount, recorded_by_user_id, date, receipt_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['Salaries', 'Contract Cameraman Daily Rate', 7000, u2.lastID, '2026-09-10', 'https://receipts.leadyfy.com/rec-0910-camera.pdf']);

    // Creator Payout
    await db.run(`
      INSERT INTO creator_payouts (creator_id, order_id, video_count, agreed_rate, total_payout, status, payment_date, reference_number, approved_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      cr1.lastID,
      o1.lastID,
      2,
      12000,
      24000,
      'PAID',
      '2026-09-12',
      'UPI-TRANS-992200331',
      u1.lastID
    ]);

    // 11. Tasks
    await db.run(`
      INSERT INTO tasks (title, description, assigned_user_id, priority, status, deadline, order_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      'Finalize Video #2 Cut for Glow Beauty',
      'Ensure background audio is licensed and client revision notes are incorporated',
      u5.lastID,
      'URGENT',
      'IN_PROGRESS',
      '2026-09-20',
      o1.lastID
    ]);

    await db.run(`
      INSERT INTO tasks (title, description, assigned_user_id, priority, status, deadline, order_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      'Follow-up with FitFuel Brand Kit Assets',
      'Need high-res PNG logo and official font files for motion graphics',
      u6.lastID,
      'HIGH',
      'TODO',
      '2026-09-21',
      o2.lastID
    ]);

    // 12. Support Tickets
    const t1 = await db.run(`
      INSERT INTO support_tickets (client_id, subject, description, priority, status, assigned_employee_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      c1.lastID,
      'Add festive Diwali discount banner in remaining 8 scripts',
      'Hi team, can we orient the upcoming scripts around our upcoming festive sale starting October 15th?',
      'MEDIUM',
      'IN_PROGRESS',
      empWriter.lastID
    ]);

    await db.run(`
      INSERT INTO ticket_replies (ticket_id, user_id, message, is_client)
      VALUES (?, ?, ?, ?)
    `, [
      t1.lastID,
      u3.lastID,
      'Hello Priya! Absolutely, our creative team has already started working on 4 festive Diwali hook concepts.',
      0
    ]);

    // 13. Notifications
    await db.run(`
      INSERT INTO notifications (user_id, title, message, event_type, reference_id)
      VALUES (?, ?, ?, ?, ?)
    `, [
      u1.lastID,
      'New Payment Received',
      'Received ₹1,00,000 for Glow Beauty (INV-2026-001).',
      'PAYMENT_RECORDED',
      1
    ]);

    await db.run(`
      INSERT INTO notifications (user_id, title, message, event_type, reference_id)
      VALUES (?, ?, ?, ?, ?)
    `, [
      u7.lastID,
      'Video Ready for Review',
      'Video #2 (7-Day Hydration Results) is ready for your review in the portal.',
      'VIDEO_CLIENT_REVIEW',
      v2.lastID
    ]);

    // 14. Activity Logs
    await db.run(`
      INSERT INTO activity_logs (actor_id, action, entity, entity_id, metadata, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      u1.lastID,
      'SYSTEM_INITIALIZED',
      'SYSTEM',
      1,
      '{"message":"Initial Leadyfy OS database seeded and normalized"}',
      '127.0.0.1'
    ]);
  });

  console.log('Seeding completed successfully!');
}

if (require.main === module) {
  seed()
    .then(() => {
      console.log('Seed script finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed script failed:', err);
      process.exit(1);
    });
}

module.exports = seed;
