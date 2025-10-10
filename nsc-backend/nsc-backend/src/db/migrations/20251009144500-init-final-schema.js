module.exports = {
  up: async (queryInterface, Sequelize) => {
    // NOTE: This migration assumes a fresh database. If you already have tables,
    // drop them first or reset your database and SequelizeMeta before running.

    // id_counters
    await queryInterface.createTable('id_counters', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      type: { type: Sequelize.ENUM('vr', 'chair'), allowNull: false, unique: true },
      last_number: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    });

    // users
    await queryInterface.createTable('users', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true },
      first_name: { type: Sequelize.STRING, allowNull: true },
      last_name: { type: Sequelize.STRING, allowNull: true },
      email: { type: Sequelize.STRING, allowNull: true, unique: true },
      password: { type: Sequelize.STRING, allowNull: true },
      role: { type: Sequelize.STRING, allowNull: false, defaultValue: 'user' },
      status: { type: Sequelize.INTEGER, allowNull: true },
      email_verified: { type: Sequelize.INTEGER, allowNull: true },
      address: { type: Sequelize.STRING, allowNull: true },
      phone_number: { type: Sequelize.STRING, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });

    // tokens
    await queryInterface.createTable('tokens', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      token: { type: Sequelize.STRING, allowNull: true },
      user_uuid: { type: Sequelize.UUID, allowNull: true },
      type: { type: Sequelize.STRING, allowNull: true },
      expires: { type: Sequelize.DATE, allowNull: true },
      blacklisted: { type: Sequelize.BOOLEAN, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });

    // videos
    await queryInterface.createTable('videos', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      title: { type: Sequelize.STRING, allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      duration_ms: { type: Sequelize.INTEGER, allowNull: true },
      video_url: { type: Sequelize.STRING, allowNull: true },
      original_name: { type: Sequelize.STRING, allowNull: true },
      mime_type: { type: Sequelize.STRING, allowNull: true },
      thumbnail_url: { type: Sequelize.STRING, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });

    // audio_tracks
    await queryInterface.createTable('audio_tracks', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      language_code: { type: Sequelize.STRING, allowNull: true },
      channels: { type: Sequelize.INTEGER, allowNull: true },
      sample_rate_hz: { type: Sequelize.INTEGER, allowNull: true },
      duration_ms: { type: Sequelize.INTEGER, allowNull: true },
      audio_url: { type: Sequelize.STRING, allowNull: true },
      mime_type: { type: Sequelize.STRING, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });

    // telemetry
    await queryInterface.createTable('telemetry', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      video_id: { type: Sequelize.INTEGER, allowNull: true },
      version: { type: Sequelize.STRING, allowNull: true },
      format: { type: Sequelize.STRING, allowNull: true },
      telemetry_url: { type: Sequelize.STRING, allowNull: true },
      checksum: { type: Sequelize.STRING, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });

    // journeys
    await queryInterface.createTable('journeys', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      title: { type: Sequelize.STRING, allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      video_id: { type: Sequelize.INTEGER, allowNull: true },
      audio_track_id: { type: Sequelize.INTEGER, allowNull: true },
      telemetry_id: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });

    // journey_audio_tracks
    await queryInterface.createTable('journey_audio_tracks', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      journey_id: { type: Sequelize.INTEGER, allowNull: true },
      audio_track_id: { type: Sequelize.INTEGER, allowNull: true },
      audio_url: { type: Sequelize.STRING, allowNull: false },
      order_index: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
      title: { type: Sequelize.STRING, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });

    // journey_telemetry
    await queryInterface.createTable('journey_telemetry', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      journey_id: { type: Sequelize.INTEGER, allowNull: true },
      telemetry_id: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });

    // vr_devices
    await queryInterface.createTable('vr_devices', {
      id: { type: Sequelize.STRING(32), primaryKey: true, allowNull: false },
      device_id: { type: Sequelize.STRING(128), allowNull: false, unique: true },
      registered_at: { type: Sequelize.DATE, allowNull: false },
      metadata: { type: Sequelize.JSON, allowNull: true },
      last_seen_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });

    // chair_devices
    await queryInterface.createTable('chair_devices', {
      id: { type: Sequelize.STRING(32), primaryKey: true, allowNull: false },
      device_id: { type: Sequelize.STRING(128), allowNull: false, unique: true },
      registered_at: { type: Sequelize.DATE, allowNull: false },
      metadata: { type: Sequelize.JSON, allowNull: true },
      last_seen_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });

    // pairing_codes
    await queryInterface.createTable('pairing_codes', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      code: { type: Sequelize.STRING(6), allowNull: false, unique: true },
      type: { type: Sequelize.ENUM('vr', 'chair'), allowNull: false },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      claimed: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      claimed_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });

    // sessions
    await queryInterface.createTable('sessions', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      vr_device_id: { type: Sequelize.STRING(32), allowNull: true },
      chair_device_id: { type: Sequelize.STRING(32), allowNull: true },
      status: { type: Sequelize.ENUM('pending', 'ready', 'running', 'paused', 'stopped', 'completed'), allowNull: false, defaultValue: 'pending' },
      overall_status: { type: Sequelize.ENUM('on_going', 'completed'), allowNull: false, defaultValue: 'on_going' },
      group_id: { type: Sequelize.STRING(64), allowNull: true },
      journey_ids: { type: Sequelize.JSON, allowNull: true },
      session_type: { type: Sequelize.ENUM('group', 'individual'), allowNull: false, defaultValue: 'individual' },
      start_time_ms: { type: Sequelize.BIGINT, allowNull: true },
      last_command: { type: Sequelize.STRING(32), allowNull: true },
      last_position_ms: { type: Sequelize.BIGINT, allowNull: true },
      conducted_at: { type: Sequelize.DATE, allowNull: true },
      total_participants: { type: Sequelize.INTEGER, allowNull: true },
      video_view_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });

    // session_logs
    await queryInterface.createTable('session_logs', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      session_id: { type: Sequelize.UUID, allowNull: false },
      event: { type: Sequelize.STRING(64), allowNull: false },
      video_id: { type: Sequelize.INTEGER, allowNull: true },
      details: { type: Sequelize.JSON, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });

    // session_participants
    await queryInterface.createTable('session_participants', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      session_id: { type: Sequelize.UUID, allowNull: false },
      vr_device_id: { type: Sequelize.STRING(32), allowNull: true },
      chair_device_id: { type: Sequelize.STRING(32), allowNull: true },
      participant_code: { type: Sequelize.STRING(6), allowNull: true },
      language: { type: Sequelize.STRING(8), allowNull: true },
      joined_at: { type: Sequelize.DATE, allowNull: true },
      left_at: { type: Sequelize.DATE, allowNull: true },
      sync_ok_rate: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      avg_drift_ms: { type: Sequelize.INTEGER, allowNull: true },
      max_drift_ms: { type: Sequelize.INTEGER, allowNull: true },
      status: { type: Sequelize.ENUM('active', 'left', 'completed'), allowNull: false, defaultValue: 'active' },
      notes: { type: Sequelize.TEXT, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });

    // playback_entries
    await queryInterface.createTable('playback_entries', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      session_id: { type: Sequelize.UUID, allowNull: false },
      participant_id: { type: Sequelize.UUID, allowNull: false },
      journey_id: { type: Sequelize.INTEGER, allowNull: true },
      video_id: { type: Sequelize.INTEGER, allowNull: true },
      language: { type: Sequelize.STRING(8), allowNull: true },
      start_time: { type: Sequelize.DATE, allowNull: false },
      end_time: { type: Sequelize.DATE, allowNull: true },
      duration_ms: { type: Sequelize.BIGINT, allowNull: true },
      completed: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      vr_sync_ok: { type: Sequelize.BOOLEAN, allowNull: true },
      chair_sync_ok: { type: Sequelize.BOOLEAN, allowNull: true },
      avg_drift_ms: { type: Sequelize.INTEGER, allowNull: true },
      max_drift_ms: { type: Sequelize.INTEGER, allowNull: true },
      error_code: { type: Sequelize.STRING(64), allowNull: true },
      error_message: { type: Sequelize.TEXT, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Drop in reverse order
    await queryInterface.dropTable('playback_entries');
    await queryInterface.dropTable('session_participants');
    await queryInterface.dropTable('session_logs');
    await queryInterface.dropTable('sessions');
    await queryInterface.dropTable('pairing_codes');
    await queryInterface.dropTable('chair_devices');
    await queryInterface.dropTable('vr_devices');
    await queryInterface.dropTable('journey_telemetry');
    await queryInterface.dropTable('journey_audio_tracks');
    await queryInterface.dropTable('journeys');
    await queryInterface.dropTable('telemetry');
    await queryInterface.dropTable('audio_tracks');
    await queryInterface.dropTable('videos');
    await queryInterface.dropTable('tokens');
    await queryInterface.dropTable('users');
    await queryInterface.dropTable('id_counters');
  },
};
