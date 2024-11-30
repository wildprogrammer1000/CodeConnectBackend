const INSERT_USER_QUERY = `
    INSERT INTO users (user_id, password, nickname)
    VALUES ($1, $2, $3)
    RETURNING id, user_id, nickname;
`;

const INSERT_PROJECT_QUERY = `
    INSERT INTO projects (title, user_id, url, thumbnail, description)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, title, user_id, url, thumbnail, description, created_at;
`;

const INSERT_COMMENT_QUERY = `
    INSERT INTO comments (user_id, project_id, content)
    VALUES ($1, $2, $3)
    RETURNING id, user_id, project_id, content, created_at;
`;

const GET_COMMENTS_QUERY = `
    SELECT c.id, c.content, c.created_at, u.user_id, u.nickname
    FROM comments c
    JOIN users u ON c.user_id = u.user_id
    WHERE c.project_id = $1
    ORDER BY c.created_at DESC;
`;

module.exports = {
  INSERT_USER_QUERY,
  INSERT_PROJECT_QUERY,
  INSERT_COMMENT_QUERY,
  GET_COMMENTS_QUERY,
};
