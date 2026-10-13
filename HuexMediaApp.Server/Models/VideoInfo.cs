namespace HuexMediaApp.Server.Models
{
    public class VideoInfo
    {
        // VideoInfo: almacenar códecs, resolución, duración y pistas de audio.

        public string VideoCodec { get; set; } = string.Empty;
        public string AudioCodec { get; set; } = string.Empty;
        public double Duration { get; set; }
        public int Width { get; set; }
        public int Height { get; set; }
        public bool RequiresTranscoding { get; set; }
    }
}
