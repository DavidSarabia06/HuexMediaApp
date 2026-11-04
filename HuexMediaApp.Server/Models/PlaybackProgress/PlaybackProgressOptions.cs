namespace HuexMediaApp.Server.Models.PlaybackProgress
{
    public sealed class PlaybackProgressOptions
    {
        /// <summary>Porcentaje mínimo para considerar visto el episodio; valor inicial 95.</summary>
        public double WatchedThresholdPercent { get; set; } = 95;
        /// <summary>Segundos finales que permiten considerarlo visto aunque falte alcanzar el porcentaje; valor inicial 120.</summary>
        public double RemainingSecondsToMarkWatched { get; set; } = 120;
    }

}
