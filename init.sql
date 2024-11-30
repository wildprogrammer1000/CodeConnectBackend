CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  -- 사용자 ID (자동 증가)
  user_id VARCHAR(50) UNIQUE NOT NULL,
  -- 사용자 ID (고유)
  password VARCHAR(255) NOT NULL,
  -- 비밀번호
  nickname VARCHAR(50) NOT NULL,
  -- 사용자 닉네임
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- 생성일
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- 수정일 (수동으로 업데이트 필요)
);

-- projects 테이블 생성
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  -- 프로젝트 ID (자동 증가)
  title VARCHAR(255) NOT NULL,
  -- 프로젝트 제목
  user_id VARCHAR(50) NOT NULL,
  -- 사용자 ID (users 테이블의 user_id)
  url VARCHAR(255),
  -- 프로젝트 URL
  thumbnail VARCHAR(255),
  -- 썸네일 이미지 URL
  description TEXT,
  -- 프로젝트 설명
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- 생성일
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- 수정일 (수동으로 업데이트 필요)
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS likes (
  id SERIAL PRIMARY KEY,
  -- 좋아요 ID (자동 증가)
  user_id VARCHAR(50) NOT NULL,
  -- 사용자 ID (users 테이블의 user_id)
  project_id INT NOT NULL,
  -- 프로젝트 ID (projects 테이블의 id)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- 좋아요 생성일
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  -- 사용자 ID에 대한 외래 키 제약 조건
  CONSTRAINT fk_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  -- 프로젝트 ID에 대한 외래 키 제약 조건
  UNIQUE (user_id, project_id) -- 사용자와 프로젝트의 조합이 유일해야 함 (한 사용자가 한 프로젝트에 대해 하나의 좋아요만 가능)
);

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  -- 댓글 ID (자동 증가)
  user_id VARCHAR(50) NOT NULL,
  -- 사용자 ID (users 테이블의 user_id)
  project_id INT NOT NULL,
  -- 프로젝트 ID (projects 테이블의 id)
  content TEXT NOT NULL,
  -- 댓글 내용
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- 댓글 생성일
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- 댓글 수정일 (수동으로 업데이트 필요)
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  -- 사용자 ID에 대한 외래 키 제약 조건
  CONSTRAINT fk_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE -- 프로젝트 ID에 대한 외래 키 제약 조건
);