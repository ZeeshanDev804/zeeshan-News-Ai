export async function ensureEngagementTables(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS engagement_polls (
      id SERIAL PRIMARY KEY,
      article_id INTEGER,
      type TEXT NOT NULL DEFAULT 'poll',
      question TEXT NOT NULL,
      options JSONB NOT NULL DEFAULT '[]'::jsonb,
      correct_option TEXT,
      explanation TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      total_votes INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS engagement_votes (
      id SERIAL PRIMARY KEY,
      poll_id INTEGER NOT NULL,
      option_key TEXT NOT NULL,
      voter_key TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (poll_id, voter_key)
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_engagement_polls_status
    ON engagement_polls(status)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_engagement_polls_article
    ON engagement_polls(article_id)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_engagement_votes_poll
    ON engagement_votes(poll_id)
  `);
}


export async function createEngagement(
  db,
  {
    articleId = null,
    type = "poll",
    question,
    options = [],
    correctOption = null,
    explanation = null,
    status = "active",
  } = {}
) {
  await ensureEngagementTables(db);

  const allowedTypes = [
    "poll",
    "quiz",
    "vote",
  ];

  if (!allowedTypes.includes(type)) {
    throw new Error(
      `Invalid engagement type: ${type}`
    );
  }

  if (!String(question || "").trim()) {
    throw new Error(
      "Engagement question is required"
    );
  }

  if (
    !Array.isArray(options) ||
    options.length < 2
  ) {
    throw new Error(
      "At least two options are required"
    );
  }

  const result = await db.query(
    `
    INSERT INTO engagement_polls (
      article_id,
      type,
      question,
      options,
      correct_option,
      explanation,
      status
    )
    VALUES (
      $1,
      $2,
      $3,
      $4::jsonb,
      $5,
      $6,
      $7
    )
    RETURNING *
    `,
    [
      articleId,
      type,
      String(question).trim(),
      JSON.stringify(options),
      correctOption,
      explanation,
      status,
    ]
  );

  return result.rows[0];
}


export async function getActiveEngagements(
  db,
  limit = 20
) {
  await ensureEngagementTables(db);

  const safeLimit = Math.min(
    Math.max(
      Number(limit) || 20,
      1
    ),
    100
  );

  const result = await db.query(
    `
    SELECT
      id,
      article_id,
      type,
      question,
      options,
      correct_option,
      explanation,
      status,
      total_votes,
      created_at,
      updated_at
    FROM engagement_polls
    WHERE status = 'active'
    ORDER BY created_at DESC
    LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
}


export async function getEngagementById(
  db,
  id
) {
  await ensureEngagementTables(db);

  const result = await db.query(
    `
    SELECT
      id,
      article_id,
      type,
      question,
      options,
      correct_option,
      explanation,
      status,
      total_votes,
      created_at,
      updated_at
    FROM engagement_polls
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}


export async function castEngagementVote(
  db,
  {
    pollId,
    optionKey,
    voterKey,
  } = {}
) {
  await ensureEngagementTables(db);

  if (!pollId) {
    throw new Error(
      "Poll ID is required"
    );
  }

  if (
    !String(optionKey || "").trim()
  ) {
    throw new Error(
      "Option is required"
    );
  }

  if (
    !String(voterKey || "").trim()
  ) {
    throw new Error(
      "Voter key is required"
    );
  }

  const poll =
    await getEngagementById(
      db,
      pollId
    );

  if (!poll) {
    throw new Error(
      "Poll not found"
    );
  }

  if (poll.status !== "active") {
    throw new Error(
      "This poll is not active"
    );
  }

  const options =
    Array.isArray(poll.options)
      ? poll.options
      : [];

  const validOption =
    options.some(
      (option) =>
        String(
          option?.key || ""
        ) ===
        String(optionKey)
    );

  if (!validOption) {
    throw new Error(
      "Invalid poll option"
    );
  }

  const existing =
    await db.query(
      `
      SELECT id
      FROM engagement_votes
      WHERE poll_id = $1
        AND voter_key = $2
      LIMIT 1
      `,
      [
        pollId,
        String(voterKey),
      ]
    );

  if (existing.rowCount > 0) {
    return {
      success: false,
      alreadyVoted: true,
      message:
        "Vote already submitted",
      poll,
    };
  }

  await db.query(
    `
    INSERT INTO engagement_votes (
      poll_id,
      option_key,
      voter_key
    )
    VALUES ($1, $2, $3)
    `,
    [
      pollId,
      String(optionKey),
      String(voterKey),
    ]
  );

  await db.query(
    `
    UPDATE engagement_polls
    SET
      total_votes =
        total_votes + 1,
      updated_at =
        CURRENT_TIMESTAMP
    WHERE id = $1
    `,
    [pollId]
  );

  const updatedPoll =
    await getEngagementById(
      db,
      pollId
    );

  return {
    success: true,
    alreadyVoted: false,
    message:
      "Vote submitted successfully",
    poll: updatedPoll,
  };
}


export async function getEngagementResults(
  db,
  pollId
) {
  await ensureEngagementTables(db);

  const poll =
    await getEngagementById(
      db,
      pollId
    );

  if (!poll) {
    return null;
  }

  const result = await db.query(
    `
    SELECT
      option_key,
      COUNT(*)::INTEGER AS votes
    FROM engagement_votes
    WHERE poll_id = $1
    GROUP BY option_key
    ORDER BY votes DESC
    `,
    [pollId]
  );

  return {
    poll,
    results: result.rows,
  };
}


export async function closeEngagement(
  db,
  pollId
) {
  await ensureEngagementTables(db);

  const result = await db.query(
    `
    UPDATE engagement_polls
    SET
      status = 'closed',
      updated_at =
        CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
    `,
    [pollId]
  );

  return result.rows[0] || null;
}


export async function getEngagementStats(
  db
) {
  await ensureEngagementTables(db);

  const result = await db.query(`
    SELECT
      COUNT(*)::INTEGER
        AS total_engagements,

      COUNT(*) FILTER (
        WHERE status = 'active'
      )::INTEGER
        AS active_engagements,

      COUNT(*) FILTER (
        WHERE type = 'poll'
      )::INTEGER
        AS polls,

      COUNT(*) FILTER (
        WHERE type = 'quiz'
      )::INTEGER
        AS quizzes,

      COUNT(*) FILTER (
        WHERE type = 'vote'
      )::INTEGER
        AS votes,

      COALESCE(
        SUM(total_votes),
        0
      )::INTEGER
        AS total_votes

    FROM engagement_polls
  `);

  return (
    result.rows[0] || {
      total_engagements: 0,
      active_engagements: 0,
      polls: 0,
      quizzes: 0,
      votes: 0,
      total_votes: 0,
    }
  );
}


export function getEngagementStoreStatus() {
  return {
    name:
      "ZEESHAN NEWS AI Engagement Store",

    status: "ready",

    supportedTypes: [
      "poll",
      "quiz",
      "vote",
    ],

    duplicateVoteProtection:
      true,

    databasePersistence:
      true,
  };
}
