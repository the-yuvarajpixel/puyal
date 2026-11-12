import { pgTable, serial, text, integer, timestamp, boolean, doublePrecision, jsonb } from 'drizzle-orm/pg-core';

// Users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  role: text('role').default('user'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Incidents table
export const incidents = pgTable('incidents', {
  id: serial('id').primaryKey(),
  incidentCode: text('incident_code').unique(),
  title: text('title').notNull(),
  category: text('category').notNull(),
  severity: text('severity').notNull(),
  severityScore: integer('severity_score').default(50),
  location: text('location').notNull(),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  affected: integer('affected').default(1),
  description: text('description').notNull(),
  contact: text('contact'),
  status: text('status').default('Pending'),
  assignedTeamId: text('assigned_team_id'),
  assignedTeamName: text('assigned_team_name'),
  reportedBy: text('reported_by'),
  source: text('source').default('web'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Emergency Teams table
export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  teamId: text('team_id').notNull().unique(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  expertise: text('expertise'),
  stationId: text('station_id'),
  stationName: text('station_name'),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  personnelCount: integer('personnel_count').default(6),
  vehicles: jsonb('vehicles'),
  contact: text('contact'),
  status: text('status').default('Available'),
  assignedIncidentId: text('assigned_incident_id'),
  assignedIncidentTitle: text('assigned_incident_title'),
  assignedAt: timestamp('assigned_at'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// SOS Alerts table
export const sosAlerts = pgTable('sos_alerts', {
  id: serial('id').primaryKey(),
  sosId: text('sos_id').notNull().unique(),
  userEmail: text('user_email'),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  accuracy: doublePrecision('accuracy'),
  status: text('status').default('Active'),
  active: boolean('active').default(true),
  timestamp: timestamp('timestamp').defaultNow(),
});
