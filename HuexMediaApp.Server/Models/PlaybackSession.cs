namespace HuexMediaApp.Server.Models
{
    public class PlaybackSession
    {

        public string SessionId { get; set; } = "";
        public double StartSeconds { get; set; }
        public double TimelineStartSeconds { get; set; }
        public double TransportTimestampOffsetSeconds { get; set; }
    }
}
