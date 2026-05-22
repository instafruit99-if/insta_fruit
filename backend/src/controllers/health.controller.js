function getHealth(req, res) {
  res.status(200).json({
    success: true,
    message: 'Backend running',
  });
}

module.exports = {
  getHealth,
};
