package tr.org.lider;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import tr.org.lider.entities.AgentImpl;
import tr.org.lider.entities.AgentStatus;
import tr.org.lider.message.service.IMessagingService;
import tr.org.lider.repositories.AgentRepository;
import tr.org.lider.services.ConfigurationService;
import tr.org.lider.services.TaskSchedulerService;

/**
 * @author <a href="mailto:ebru.arslan@pardus.org.tr">Ebru Arslan</a>
 */

@Component
@EnableScheduling
public class LiderCronJob {
	
	@Autowired
	private  AgentRepository agentRepository;
	
	@Autowired
	private IMessagingService messagingService;
	
	@Autowired
	private ConfigurationService configurationService;
	
	@Autowired
	private TaskSchedulerService taskScheduledService;

	Logger logger = LoggerFactory.getLogger(this.getClass());

	
	@Scheduled(cron = "0 55 10 * * ?")
    public void dailyCronJob() {
		
		
		if(configurationService.getMachineEventStatus() == true) {
			Date today = new Date();
			List<AgentImpl> agentsEventDate =  agentRepository.findAll();
		
			for(AgentImpl agent : agentsEventDate) {
			
				if(!(messagingService.isRecipientOnline(agent.getJid()))) {

				Date eventDate = agent.getEventDate();
				if (eventDate != null) {
					LocalDate todayLocalDate = today.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
					LocalDate dbEventDate = eventDate.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
					
					long daysDifference = ChronoUnit.DAYS.between(todayLocalDate, dbEventDate);

					if (daysDifference > -configurationService.getMachineEventDay()) {
					
						agent.setAgentStatus(AgentStatus.Active);
						agentRepository.save(agent);
					} 
					else {
						agent.setAgentStatus(AgentStatus.Passive);
						agentRepository.save(agent);
					}
				} 
				else {
					logger.info("Event date is null for agent: " + agent.getId());
					}
				}
			}
		
			logger.info("Executed cron job for machine update");
		}
    }
	
	@Scheduled(cron = "0 */20 * * * ?")
	public void taskJob() {
		try {
			taskScheduledService.sendScheduledTaskMesasage();
		} catch (IndexOutOfBoundsException e) {
	       logger.info("Array size is not enough" + e.getMessage());
	    } catch (Throwable t) {
	    	logger.info(t.getMessage());
	    }
		
	}
}
