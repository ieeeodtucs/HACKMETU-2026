package tr.org.lider.repositories;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;
import javax.persistence.TypedQuery;
import javax.persistence.criteria.CriteriaBuilder;
import javax.persistence.criteria.CriteriaQuery;
import javax.persistence.criteria.Join;
import javax.persistence.criteria.Predicate;
import javax.persistence.criteria.Root;

import org.apache.commons.collections.CollectionUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import tr.org.lider.dto.AgentDTO;
import tr.org.lider.entities.AgentImpl;
import tr.org.lider.entities.AgentPropertyImpl;

/*
 * AgentInfoCriteriaBuilder implements filtering agents with multiple data.
 * Filter can be applied over status(online, offline) registration date and agent properties
 * 
 * @author <a href="mailto:hasan.kara@pardus.org.tr">Hasan Kara</a>
 * @author <a href="mailto:ebru.arslan@pardus.org.tr">Ebru Arslan</a>
 */

@Service
public class AgentInfoCriteriaBuilder {

	@PersistenceContext
	private EntityManager entityManager;

	public Page<AgentImpl> filterAgents(AgentDTO agentDTO,List<String> listOfOnlineUsers){
		
		PageRequest pageable = PageRequest.of(agentDTO.getPageNumber() - 1, agentDTO.getPageSize());

		CriteriaBuilder cb = entityManager.getCriteriaBuilder();
		//for filtered result count
		CriteriaBuilder cbCount = entityManager.getCriteriaBuilder();
		CriteriaQuery<Long> criteriaCount = cbCount.createQuery(Long.class);
		Root<AgentImpl> fromCount = criteriaCount.from(AgentImpl.class);
		criteriaCount.select(cbCount.count(fromCount));

		CriteriaQuery<AgentImpl> criteriaQuery = cb.createQuery(AgentImpl.class);
		Root<AgentImpl> from = criteriaQuery.from(AgentImpl.class);
		CriteriaQuery<AgentImpl> select = criteriaQuery.select(from);

		List<Predicate> predicates = new ArrayList<>();
		//for filtered result count
		List<Predicate> predicatesCount = new ArrayList<>();


		if(agentDTO.getDn().get() != null && !agentDTO.getDn().get().equals("")) {
			predicates.add(cb.like(from.get("dn").as(String.class), "%" + agentDTO.getDn().get() + "%"));
			predicatesCount.add(cbCount.like(fromCount.get("dn").as(String.class), "%" + agentDTO.getDn().get() + "%"));
		}

		if (agentDTO.getRegistrationStartDate() != null) {
			predicates.add(cb.greaterThanOrEqualTo(from.get("createDate"), agentDTO.getRegistrationStartDate().get()));
			predicatesCount.add(cbCount.greaterThanOrEqualTo(fromCount.get("createDate"), agentDTO.getRegistrationStartDate().get()));
		}
		if (agentDTO.getRegistrationEndDate() != null) {
			predicates.add(cb.lessThanOrEqualTo(from.get("createDate"), agentDTO.getRegistrationEndDate().get()));
			predicatesCount.add(cbCount.lessThanOrEqualTo(fromCount.get("createDate"), agentDTO.getRegistrationEndDate().get()));
		}

		if(agentDTO.getStatus().get().equals("ONLINE") ) {
			predicates.add(cb.in(from.get("jid"))
					.value(!CollectionUtils.isEmpty(listOfOnlineUsers)? listOfOnlineUsers : new ArrayList<String>(Arrays.asList(""))));
			predicatesCount.add(cbCount.in(fromCount.get("jid"))
					.value(!CollectionUtils.isEmpty(listOfOnlineUsers)? listOfOnlineUsers : new ArrayList<String>(Arrays.asList(""))));
		} else if(agentDTO.getStatus().get().equals("OFFLINE")) {
			predicates.add(
					cb.not(from.get("jid").in(
							!CollectionUtils.isEmpty(listOfOnlineUsers)? listOfOnlineUsers : new ArrayList<String>(Arrays.asList("")))));
			predicatesCount.add(
					cbCount.not(fromCount.get("jid").in(
							!CollectionUtils.isEmpty(listOfOnlineUsers)? listOfOnlineUsers : new ArrayList<String>(Arrays.asList("")))));
		}

		if(agentDTO.getHostname().get() != null  && !agentDTO.getHostname().get().equals("")) {
			predicates.add(cb.like(from.get("hostname").as(String.class), "%" + agentDTO.getHostname().get() + "%"));
			predicatesCount.add(cbCount.like(fromCount.get("hostname").as(String.class), "%" + agentDTO.getHostname().get() + "%") );
		}
		
		if(agentDTO.getMacAddress().get() != null && !agentDTO.getMacAddress().get().equals("")) {
			predicates.add(cb.like(from.get("macAddresses").as(String.class), "%" + agentDTO.getMacAddress().get() + "%"));
			predicatesCount.add(cbCount.like(fromCount.get("macAddresses").as(String.class), "%" + agentDTO.getMacAddress().get() + "%") );
		}
		
		if(agentDTO.getIpAddress().get() != null && !agentDTO.getIpAddress().get().equals("")) {
			predicates.add(cb.like(from.get("ipAddresses").as(String.class), "%" + agentDTO.getIpAddress().get() + "%"));
			predicatesCount.add(cbCount.like(fromCount.get("ipAddresses").as(String.class), "%" + agentDTO.getIpAddress().get() + "%") );
		}
		
		if(agentDTO.getBrand().get() != null && !agentDTO.getBrand().get().equals("")) {
			Join<AgentImpl, AgentPropertyImpl> properties = from.join("properties");
			Predicate namePredicate = cb.like(properties.get("propertyName").as(String.class), "hardware.baseboard.manufacturer");
			Predicate valuePredicate = cb.like(properties.get("propertyValue").as(String.class), agentDTO.getBrand().get());
			predicates.add(cb.and(namePredicate, valuePredicate));

			//for count 
			Join<AgentImpl, AgentPropertyImpl> propertiesCount = fromCount.join("properties");
			Predicate namePredicateCount = cbCount.like(propertiesCount.get("propertyName").as(String.class), "hardware.baseboard.manufacturer");
			Predicate valuePredicateCount = cbCount.like(propertiesCount.get("propertyValue").as(String.class), agentDTO.getBrand().get());
			predicatesCount.add(cbCount.and(namePredicateCount, valuePredicateCount));
		}

		if(agentDTO.getModel().get() != null && !agentDTO.getModel().get().equals("")) {
			Join<AgentImpl, AgentPropertyImpl> properties = from.join("properties");
			Predicate namePredicate = cb.like(properties.get("propertyName").as(String.class), "hardware.baseboard.productName");
			Predicate valuePredicate = cb.like(properties.get("propertyValue").as(String.class), agentDTO.getModel().get());
			predicates.add(cb.and(namePredicate, valuePredicate));

			//for count 
			Join<AgentImpl, AgentPropertyImpl> propertiesCount = fromCount.join("properties");
			Predicate namePredicateCount = cbCount.like(propertiesCount.get("propertyName").as(String.class), "hardware.baseboard.productName");
			Predicate valuePredicateCount = cbCount.like(propertiesCount.get("propertyValue").as(String.class), agentDTO.getModel().get());
			predicatesCount.add(cbCount.and(namePredicateCount, valuePredicateCount));
		}

		if(agentDTO.getProcessor().get() != null && !agentDTO.getProcessor().get().equals("")) {
			Join<AgentImpl, AgentPropertyImpl> properties = from.join("properties");
			Predicate namePredicate = cb.like(properties.get("propertyName").as(String.class), "processor");
			Predicate valuePredicate = cb.like(properties.get("propertyValue").as(String.class), agentDTO.getProcessor().get());
			predicates.add(cb.and(namePredicate, valuePredicate));

			//for count 
			Join<AgentImpl, AgentPropertyImpl> propertiesCount = fromCount.join("properties");
			Predicate namePredicateCount = cbCount.like(propertiesCount.get("propertyName").as(String.class), "processor");
			Predicate valuePredicateCount = cbCount.like(propertiesCount.get("propertyValue").as(String.class), agentDTO.getProcessor().get());
			predicatesCount.add(cbCount.and(namePredicateCount, valuePredicateCount));
		}
		
		if(agentDTO.getOsVersion().get() !=  null && !agentDTO.getOsVersion().get().equals("" ) && !agentDTO.getOsVersion().get().equals("null")) {
			Join<AgentImpl, AgentPropertyImpl> properties = from.join("properties");
			Predicate namePredicate = cb.like(properties.get("propertyName").as(String.class), "os.version");
			Predicate valuePredicate = cb.like(properties.get("propertyValue").as(String.class), agentDTO.getOsVersion().get());
			predicates.add(cb.and(namePredicate, valuePredicate));

			//for count 
			Join<AgentImpl, AgentPropertyImpl> propertiesCount = fromCount.join("properties");
			Predicate namePredicateCount = cbCount.like(propertiesCount.get("propertyName").as(String.class), "os.version");
			Predicate valuePredicateCount = cbCount.like(propertiesCount.get("propertyValue").as(String.class), agentDTO.getOsVersion().get());
			predicatesCount.add(cbCount.and(namePredicateCount, valuePredicateCount));
		}
		
		if(agentDTO.getAgentVersion().get() != null && !agentDTO.getAgentVersion().get().equals("")) {
			Join<AgentImpl, AgentPropertyImpl> properties = from.join("properties");
			Predicate namePredicate = cb.like(properties.get("propertyName").as(String.class), "agentVersion");
			Predicate valuePredicate = cb.like(properties.get("propertyValue").as(String.class), agentDTO.getAgentVersion().get());
			predicates.add(cb.and(namePredicate, valuePredicate));

			//for count 
			Join<AgentImpl, AgentPropertyImpl> propertiesCount = fromCount.join("properties");
			Predicate namePredicateCount = cbCount.like(propertiesCount.get("propertyName").as(String.class), "agentVersion");
			Predicate valuePredicateCount = cbCount.like(propertiesCount.get("propertyValue").as(String.class), agentDTO.getAgentVersion().get());
			predicatesCount.add(cbCount.and(namePredicateCount, valuePredicateCount));
		}
		
		if(agentDTO.getDiskType().get() != null && !agentDTO.getDiskType().get().equals("") && !agentDTO.getDiskType().get().equals("ALL")) {
			
			Join<AgentImpl, AgentPropertyImpl> properties = from.join("properties");
			Predicate namePredicate = cb.like(properties.get("propertyName").as(String.class),agentDTO.getDiskType().get());
			predicates.add(namePredicate);

			//for count 
			Join<AgentImpl, AgentPropertyImpl> propertiesCount = fromCount.join("properties");
			Predicate namePredicateCount = cbCount.like(propertiesCount.get("propertyName").as(String.class),agentDTO.getDiskType().get());
			predicatesCount.add(namePredicateCount);
		}
		
		//Session time dropdown closed for frontend and backend
//		if(sessionReportType.isPresent() && !sessionReportType.get().equals("")) {
////		if(sessionReportType != null) {
//			Date sessionFilterDate = null;
//			Date now = new Date();
//			if(sessionReportType.get().equals("LAST_ONE_MONTH_NO_SESSIONS")) { 
//				predicates.add(
//						cb.not(from.get("jid").in(
//								!CollectionUtils.isEmpty(listOfOnlineUsers)? listOfOnlineUsers : new ArrayList<String>(Arrays.asList("")))));
//				predicatesCount.add(
//						cb.not(fromCount.get("jid").in(
//								!CollectionUtils.isEmpty(listOfOnlineUsers)? listOfOnlineUsers : new ArrayList<String>(Arrays.asList("")))));
//				
//				sessionFilterDate = Date.from(ZonedDateTime.now().minusMonths(1).toInstant());
//				predicates.add(cb.between(from.get("lastLoginDate"), sessionFilterDate, new Date()).not());
//				predicatesCount.add(cbCount.between(fromCount.get("lastLoginDate"), sessionFilterDate, now).not());
//			} else if(sessionReportType.get().equals("LAST_TWO_MONTHS_NO_SESSIONS")) {
//				predicates.add(
//						cb.not(from.get("jid").in(
//								!CollectionUtils.isEmpty(listOfOnlineUsers)? listOfOnlineUsers : new ArrayList<String>(Arrays.asList("")))));
//				predicatesCount.add(
//						cbCount.not(fromCount.get("jid").in(
//								!CollectionUtils.isEmpty(listOfOnlineUsers)? listOfOnlineUsers : new ArrayList<String>(Arrays.asList("")))));
//				
//				sessionFilterDate = Date.from(ZonedDateTime.now().minusMonths(2).toInstant());
//				predicates.add(cb.between(from.get("lastLoginDate"), sessionFilterDate, new Date()).not());
//				predicatesCount.add(cbCount.between(fromCount.get("lastLoginDate"), sessionFilterDate, now).not());
//			} else if(sessionReportType.get().equals("LAST_THREE_MONTHS_NO_SESSIONS")) {
//				predicates.add(
//						cb.not(from.get("jid").in(
//								!CollectionUtils.isEmpty(listOfOnlineUsers)? listOfOnlineUsers : new ArrayList<String>(Arrays.asList("")))));
//				predicatesCount.add(
//						cbCount.not(fromCount.get("jid").in(
//								!CollectionUtils.isEmpty(listOfOnlineUsers)? listOfOnlineUsers : new ArrayList<String>(Arrays.asList("")))));
//				
//				sessionFilterDate = Date.from(ZonedDateTime.now().minusMonths(3).toInstant());
//				predicates.add(cb.between(from.get("lastLoginDate"), sessionFilterDate, new Date()).not());
//				predicatesCount.add(cbCount.between(fromCount.get("lastLoginDate"), sessionFilterDate, now).not());
//			} else if(sessionReportType.get().equals("LAST_ONE_MONTH_SESSIONS")) {
//				sessionFilterDate = Date.from(ZonedDateTime.now().minusMonths(1).toInstant());
//				predicates.add(cb.between(from.get("lastLoginDate"), sessionFilterDate, new Date()));
//				predicatesCount.add(cbCount.between(fromCount.get("lastLoginDate"), sessionFilterDate, now));
//			} else if(sessionReportType.get().equals("LAST_TWO_MONTHS_SESSIONS")) {
//				sessionFilterDate = Date.from(ZonedDateTime.now().minusMonths(2).toInstant());
//				predicates.add(cb.between(from.get("lastLoginDate"), sessionFilterDate, new Date()));
//				predicatesCount.add(cbCount.between(fromCount.get("lastLoginDate"), sessionFilterDate, now));
//			} else if(sessionReportType.get().equals("LAST_THREE_MONTHS_SESSIONS")) {
//				sessionFilterDate = Date.from(ZonedDateTime.now().minusMonths(3).toInstant());
//				predicates.add(cb.between(from.get("lastLoginDate"), sessionFilterDate, new Date()));
//				predicatesCount.add(cbCount.between(fromCount.get("lastLoginDate"), sessionFilterDate, now));
//			}
//
//		}
		
		if(agentDTO.getAgentStatus().get() != null && !agentDTO.getAgentStatus().get().equals("")) {
			predicates.add(cb.equal(from.get("agentStatus"), agentDTO.getAgentStatus().get()));
			predicatesCount.add(cb.equal(fromCount.get("agentStatus"), agentDTO.getAgentStatus().get()));
		}

		criteriaQuery.where(predicates.toArray(new Predicate[predicates.size()]));
		criteriaQuery.orderBy(cb.desc(from.get("createDate")));
		Long count = count(cbCount, predicatesCount, criteriaCount);

		TypedQuery<AgentImpl> typedQuery = entityManager.createQuery(select);
		typedQuery.setFirstResult((agentDTO.getPageNumber() - 1) * agentDTO.getPageSize());
		if(agentDTO.getPageNumber() * agentDTO.getPageSize() > count) {
			typedQuery.setMaxResults((int) (count%agentDTO.getPageSize()));
		} else {
			typedQuery.setMaxResults(agentDTO.getPageSize());
		}
		
		Page<AgentImpl> agents = new PageImpl<AgentImpl>(typedQuery.getResultList(), pageable, count);

		return agents;
		
	}

	/*
	 * get count of filtered data for paging
	 */
	public Long count(CriteriaBuilder builder, List<Predicate> restrictions, CriteriaQuery<Long> criteria ) {
		criteria.where(restrictions.toArray(new Predicate[restrictions.size()]));
		TypedQuery<Long> query = entityManager.createQuery(criteria);
		return query.getSingleResult();
	}
}