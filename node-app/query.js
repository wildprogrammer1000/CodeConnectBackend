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

const GET_PROJECT_BY_ID_QUERY = `
    SELECT p.*, 
           u.nickname, 
           COUNT(DISTINCT l2.id) AS like_count,  -- likes 테이블의 행 개수를 like_count로 추출
           COUNT(DISTINCT c.id) AS comment_count,
           CASE 
             WHEN COUNT(l.id) > 0 THEN TRUE 
             ELSE FALSE 
           END AS liked
    FROM projects p 
    JOIN users u ON p.user_id = u.user_id
    LEFT JOIN likes l ON p.id = l.project_id AND l.user_id = $1  -- 현재 사용자 ID로 좋아요 여부 확인
    LEFT JOIN likes l2 ON p.id = l2.project_id
    LEFT JOIN comments c ON p.id = c.project_id
    WHERE p.id = $2
    GROUP BY p.id, u.nickname;
`;

module.exports = {
  INSERT_USER_QUERY,
  INSERT_PROJECT_QUERY,
  INSERT_COMMENT_QUERY,
  GET_COMMENTS_QUERY,
  GET_PROJECT_BY_ID_QUERY,
};
