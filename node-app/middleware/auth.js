const jwt = require("jsonwebtoken");

const auth = (req, res, next) => {
  const token = req.cookies.token; // 쿠키에서 JWT 추출

  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({ message: "유효하지 않은 토큰입니다." });
      }
      req.user = decoded; // 사용자 정보를 req에 저장
    });
  }
  next(); // 다음 미들웨어로 이동
};

module.exports = auth;
