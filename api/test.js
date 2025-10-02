module.exports = async (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    message: 'API is working!',
    timestamp: new Date().toISOString()
  });
};
