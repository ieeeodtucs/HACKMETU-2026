package tr.org.lider.cache;

import org.ehcache.event.CacheEvent;
import org.ehcache.event.CacheEventListener;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * @author <a href="mailto:hasan.kara@pardus.org.tr">Hasan Kara</a>
 */
public class CustomCacheEventLogger implements CacheEventListener<Object, Object> {

	Logger logger = LoggerFactory.getLogger(this.getClass());

	@Override
	public void onEvent(CacheEvent<? extends Object, ? extends Object> cacheEvent) {
		logger.info("Cache event = {}, Key = {},  Old value = {}, New value = {}", cacheEvent.getType(),
                cacheEvent.getKey(), cacheEvent.getOldValue(), "***");
	}
}