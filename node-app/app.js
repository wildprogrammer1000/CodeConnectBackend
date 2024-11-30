require("dotenv").config();
const express = require("express");
const cors = require("cors"); // CORS 패키지 추가
const { Pool } = require("pg"); // PostgreSQL 클라이언트
const bcrypt = require("bcryptjs"); // bcryptjs로 변경
const {
  INSERT_USER_QUERY,
  INSERT_PROJECT_QUERY,
  INSERT_COMMENT_QUERY,
  GET_COMMENTS_QUERY,
} = require("./query"); // 쿼리 파일 가져오기
const app = express();
const PORT = process.env.PORT || 3000;
const jwt = require("jsonwebtoken"); // JWT 라이브러리 추가
const auth = require("./middleware/auth"); // 미들웨어 가져오기
const cookieParser = require("cookie-parser");
const AWS = require("aws-sdk"); // AWS SDK 추가
const multer = require("multer"); // multer 추가

// PostgreSQL 연결 설정
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// AWS S3 설정
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// CORS 설정
const allowedOrigins = process.env.ALLOWED_ORIGINS.split(","); // 환경변수에서 Origin 배열 가져오기
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// 미들웨어 설정
app.use(express.json());
app.use(cookieParser());

// 기본 라우트 설정
app.get("/", (req, res) => {
  res.send("Hello, World!");
});

// 닉네임 중복 체크 API
app.post("/api/check-nickname", async (req, res) => {
  const { nickname } = req.body;

  try {
    const result = await pool.query("SELECT * FROM users WHERE nickname = $1", [
      nickname,
    ]);
    if (result.rows.length > 0) {
      return res
        .status(409)
        .json({ available: false, message: "닉네임이 이미 사용 중입니다." });
    }
    return res
      .status(200)
      .json({ available: true, message: "사용 가능한 닉네임입니다." });
  } catch (error) {
    console.error("Error checking nickname:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
});

// 사용자 아이디 중복 체크 API
app.post("/api/check-username", async (req, res) => {
  const { username } = req.body;

  try {
    const result = await pool.query("SELECT * FROM users WHERE user_id = $1", [
      username,
    ]);
    if (result.rows.length > 0) {
      return res
        .status(409)
        .json({ available: false, message: "아이디가 이미 사용 중입니다." });
    }
    return res
      .status(200)
      .json({ available: true, message: "사용 가능한 아이디입니다." });
  } catch (error) {
    console.error("Error checking username:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
});

// 회원 정보 등록 API
app.post("/api/register", async (req, res) => {
  const { username, password, nickname } = req.body;

  try {
    // 비밀번호 암호화
    const hashedPassword = await bcrypt.hash(password, 10);

    // 사용자 정보 등록
    const result = await pool.query(INSERT_USER_QUERY, [
      username,
      hashedPassword,
      nickname,
    ]);
    const newUser = result.rows[0];

    return res.status(201).json({ message: "회원가입 성공", user: newUser });
  } catch (error) {
    console.error("Error registering user:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
});

// 프로젝트 등록 API
const upload = multer();
app.post("/api/projects", upload.single("thumbnail"), async (req, res) => {
  const { title, user_id, url, description } = req.body; // FormData에서 값 추출
  const thumbnail = req.file; // multer를 사용하여 파일을 가져옴

  try {
    // 동일한 프로젝트 이름이 존재하는지 확인
    const existingProject = await pool.query(
      "SELECT * FROM projects WHERE title = $1 AND user_id = $2",
      [title, user_id]
    );

    if (existingProject.rowCount > 0) {
      return res.status(409).json({ message: "동일한 프로젝트 이름이 이미 존재합니다." });
    }

    let thumbnailUrl = "";

    // 이미지 파일이 존재할 경우 S3에 업로드
    if (thumbnail) {
      const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: `${user_id}/${title}`, // 파일 이름 설정
        Body: thumbnail.buffer, // 파일 데이터
        ContentType: thumbnail.mimetype, // 파일 MIME 타입
      };

      const s3Response = await s3.upload(params).promise();
      thumbnailUrl = s3Response.Location; // S3에서 반환된 파일 URL
    }

    // 프로젝트 정보 등록
    const result = await pool.query(INSERT_PROJECT_QUERY, [
      title,
      user_id,
      url,
      thumbnailUrl, // S3에서 업로드한 이미지 URL 사용
      description,
    ]);
    const newProject = result.rows[0];

    return res
      .status(201)
      .json({ message: "프로젝트 등록 성공", project: newProject });
  } catch (error) {
    console.error("Error registering project:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
});

// 프로젝트 목록 조회 API 추가
app.get("/api/projects", auth, async (req, res) => {
  const userId = req.user ? req.user.user_id : null; // req.user에서 사용자 ID 가져오기

  try {
    const result = await pool.query(
      `
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
      GROUP BY p.id, u.nickname
      ORDER BY p.created_at DESC
    `,
      [userId] // 현재 사용자 ID를 쿼리에 전달
    );

    const projects = result.rows;

    return res.status(200).json({ projects });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
});

// 특정 프로젝트 조회 API
app.get("/api/projects/:id", auth, async (req, res) => {
  const { id } = req.params;
  const userId = req.user ? req.user.user_id : null; // req.user에서 사용자 ID 가져오기

  try {
    const result = await pool.query(
      `
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
      GROUP BY p.id, u.nickname
      ORDER BY p.created_at DESC`,
      [userId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "프로젝트를 찾을 수 없습니다." });
    }

    const project = result.rows[0];
    return res.status(200).json({ project });
  } catch (error) {
    console.error("Error fetching project:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
});

// 로그아웃 API
app.post("/api/logout", (_, res) => {
  res.clearCookie("token", { path: "/" }); // 쿠키 삭제
  return res.status(200).json({ message: "로그아웃 성공" });
});

// 로그인 API
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    // 사용자 정보 조회
    const result = await pool.query("SELECT * FROM users WHERE user_id = $1", [
      username,
    ]);
    if (result.rows.length === 0) {
      return res
        .status(401)
        .json({ message: "아이디 또는 비밀번호가 잘못되었습니다." });
    }

    const user = result.rows[0];

    // 비밀번호 검증
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ message: "아이디 또는 비밀번호가 잘못되었습니다." });
    }

    // JWT 생성
    const token = jwt.sign(
      { user_id: user.user_id, id: user.id },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h", // 토큰 만료 시간 설정
      }
    );

    // 로그인 성공 시 쿠키에 JWT 저장
    res.cookie("token", token, {
      httpOnly: true, // JavaScript에서 접근 불가
      secure: true, // HTTPS에서만 전송
      sameSite: "None",
      maxAge: 3600000, // 1시간
    });

    // 사용자 정보 반환
    return res.status(200).json({
      message: "로그인 성공",
      user: { id: user.id, user_id: user.user_id, nickname: user.nickname },
    });
  } catch (error) {
    console.error("Error logging in:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
});

// 프로젝트 삭제 API
app.delete("/api/projects/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // 프로젝트 정보 조회
    const projectResult = await pool.query(
      "SELECT * FROM projects WHERE id = $1",
      [id]
    );

    if (projectResult.rowCount === 0) {
      return res.status(404).json({ message: "프로젝트를 찾을 수 없습니다." });
    }

    const project = projectResult.rows[0];

    // 썸네일이 존재할 경우 S3에서 삭제
    if (project.thumbnail) {
      const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: `${project.user_id}/${project.title}`, // 파일 이름 규칙에 맞게 설정
      };

      await s3.deleteObject(params).promise(); // S3에서 파일 삭제
    }

    // 프로젝트 삭제
    const deleteResult = await pool.query(
      "DELETE FROM projects WHERE id = $1 RETURNING *",
      [id]
    );

    return res.status(200).json({ message: "프로젝트 삭제 성공" });
  } catch (error) {
    console.error("Error deleting project:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
});

// 프로젝트 수정 API
app.put("/api/projects/:id", async (req, res) => {
  const { id } = req.params;
  const { title, user_id, url, thumbnail, description } = req.body;

  try {
    // 프로젝트 정보 수정
    const result = await pool.query(
      `
      UPDATE projects 
      SET title = $1, user_id = $2, url = $3, thumbnail = $4, description = $5 
      WHERE id = $6 
      RETURNING *
    `,
      [title, user_id, url, thumbnail, description, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "프로젝트를 찾을 수 없습니다." });
    }

    const updatedProject = result.rows[0];
    return res
      .status(200)
      .json({ message: "프로젝트 수정 성공", project: updatedProject });
  } catch (error) {
    console.error("Error updating project:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
});

// 좋아요 토글 API
app.post("/api/like", auth, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "로그인이 필요합니다." });
  }

  const { projectId, liked } = req.body;
  const userId = req.user.user_id; // 미들웨어를 통해 사용자 ID 가져오기

  try {
    if (liked) {
      // 현재 상태가 true일 경우 좋아요 삭제
      await pool.query(
        "DELETE FROM likes WHERE user_id = $1 AND project_id = $2",
        [userId, projectId]
      );
    } else {
      // 현재 상태가 false일 경우 좋아요 추가
      await pool.query(
        "INSERT INTO likes (user_id, project_id) VALUES ($1, $2)",
        [userId, projectId]
      );
    }

    // 좋아요 처리 후 해당 프로젝트의 최신 데이터 가져오기
    const projectResult = await pool.query(
      `
      SELECT p.*, 
             COUNT(DISTINCT l.id) AS like_count, 
             CASE 
               WHEN l.user_id IS NOT NULL THEN TRUE 
               ELSE FALSE 
             END AS liked
      FROM projects p 
      LEFT JOIN likes l ON p.id = l.project_id
      WHERE p.id = $1
      GROUP BY p.id, l.user_id
    `,
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ message: "프로젝트를 찾을 수 없습니다." });
    }

    const updatedProject = projectResult.rows[0];

    return res.status(200).json({
      message: liked ? "좋아요가 삭제되었습니다." : "좋아요가 추가되었습니다.",
      project: updatedProject, // 업데이트된 프로젝트 데이터 반환
    });
  } catch (error) {
    console.error("Error toggling like:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
});

// 사용자 정보 조회 API
app.get("/api/user", auth, async (req, res) => {
  const userId = req.user ? req.user.user_id : null;

  if (!userId) return res.status(200);

  try {
    const userId = req.user.user_id;
    const result = await pool.query("SELECT * FROM users WHERE user_id = $1", [
      userId,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    }

    const user = result.rows[0];
    return res.status(200).json({ user });
  } catch (error) {
    console.error("Error fetching user info:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
});
app.post("/api/comments", async (req, res) => {
  const { projectId, userId, content } = req.body;

  if (!projectId || !userId || !content) {
    return res.status(400).json({ message: "모든 필드를 입력해야 합니다." });
  }

  try {
    const result = await pool.query(INSERT_COMMENT_QUERY, [
      userId,
      projectId,
      content,
    ]);

    const newComment = result.rows[0];
    res
      .status(201)
      .json({ message: "댓글이 추가되었습니다.", comment: newComment });
  } catch (error) {
    console.error("댓글 추가 오류:", error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});
// 댓글 목록 조회 API
app.get("/api/comments/:projectId", async (req, res) => {
  const { projectId } = req.params;

  try {
    const result = await pool.query(GET_COMMENTS_QUERY, [projectId]);
    const comments = result.rows;
    res.status(200).json({ comments });
  } catch (error) {
    console.error("댓글 목록 조회 오류:", error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});
// 댓글 삭제 API
app.delete("/api/comments/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM comments WHERE id = $1 RETURNING *",
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "댓글을 찾을 수 없습니다." });
    }
    return res.status(200).json({ message: "댓글 삭제 성공" });
  } catch (error) {
    console.error("Error deleting comment:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
});
// 서버 시작
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
