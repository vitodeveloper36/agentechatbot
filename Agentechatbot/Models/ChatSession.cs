namespace Agentechatbot.Models
{
    public class ChatSession
    {
        public Guid SessionId { get; set; }
        public string Usuario { get; set; }
        public DateTime StartedAt { get; set; }
        public DateTime LastActivity { get; set; }
        public bool IsClosed { get; set; }
    }
}
